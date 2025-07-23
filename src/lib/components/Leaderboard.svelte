<script>
  import { onMount } from 'svelte';
  import { gameStore } from '../stores/game.js';
  import { db, formatAddress } from '../supabase.js';

  let topPlayers = [];
  let loading = true;
  let error = null;

  // Load leaderboard from database on mount
  onMount(async () => {
    await loadLeaderboard();
  });

  async function loadLeaderboard() {
    try {
      loading = true;
      error = null;
      
      // Get top players from database
      const dbPlayers = await db.getTopPlayers(10, 'total_shots');
      
      if (dbPlayers && dbPlayers.length > 0) {
        // Transform database format to component format and add ranks
        topPlayers = dbPlayers.map((player, index) => ({
          address: player.address,
          totalShots: player.total_shots || 0,
          totalSpent: player.total_spent || '0',
          totalWon: player.total_won || '0',
          rank: index + 1
        }));
      } else {
        // No players in database yet
        topPlayers = [];
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      error = 'Failed to load leaderboard';
      topPlayers = [];
    } finally {
      loading = false;
    }
  }

  // Truncate address for display
  const truncateAddress = (address) => {
    return formatAddress(address);
  };

  // Get rank badge color
  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return 'text-yellow-400';
      case 2:
        return 'text-gray-300';
      case 3:
        return 'text-orange-400';
      default:
        return 'text-gray-500';
    }
  };

  // Get rank icon
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };
</script>

<div class="leaderboard">
  <div class="leaderboard-header">
    <h3 class="text-lg font-bold text-white flex items-center space-x-2">
      <span>🏆</span>
      <span>Top Players</span>
    </h3>
    <p class="text-sm text-gray-400">Most shots taken this week</p>
  </div>

  <div class="leaderboard-list">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p class="text-gray-400">Loading leaderboard...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-text">
          <p class="text-red-400">{error}</p>
          <button
            class="retry-button"
            on:click={loadLeaderboard}
          >
            Try Again
          </button>
        </div>
      </div>
    {:else if topPlayers.length > 0}
      {#each topPlayers as player (player.address)}
        <div class="player-row">
          <!-- Rank -->
          <div class="rank-badge {getRankColor(player.rank)}">
            <span class="rank-icon">{getRankIcon(player.rank)}</span>
          </div>

          <!-- Player Info -->
          <div class="player-info">
            <div class="player-address">
              {truncateAddress(player.address)}
            </div>
            <div class="player-stats">
              <span class="stat-item">
                <span class="stat-value">{player.totalShots}</span>
                <span class="stat-label">shots</span>
              </span>
              {#if parseFloat(player.totalWon) > 0}
                <span class="stat-item winner">
                  <span class="stat-value">+{parseFloat(player.totalWon).toFixed(3)}</span>
                  <span class="stat-label">ETH</span>
                </span>
              {/if}
            </div>
          </div>

          <!-- Spent Amount -->
          <div class="spent-amount">
            <div class="spent-value">{parseFloat(player.totalSpent).toFixed(3)} ETH</div>
            <div class="spent-label">spent</div>
          </div>
        </div>
      {/each}
    {:else}
      <div class="no-players">
        <div class="no-players-icon">🏆</div>
        <div class="no-players-text">
          <p class="text-gray-400">No players yet!</p>
          <p class="text-sm text-gray-500">Be the first to take a shot</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- View All Button -->
  <div class="leaderboard-footer">
    <a 
      href="/leaderboard" 
      class="view-all-btn"
    >
      View Full Leaderboard
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </a>
  </div>
</div>

<style>
  .leaderboard {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6;
  }

  .leaderboard-header {
    @apply mb-6 text-center;
  }

  .leaderboard-list {
    @apply space-y-3;
  }

  .player-row {
    @apply flex items-center space-x-4 p-3 rounded-lg;
    @apply bg-gray-900/50 border border-gray-700;
    @apply hover:bg-gray-900/70 transition-colors;
  }

  .rank-badge {
    @apply flex-shrink-0 w-8 text-center font-bold;
  }

  .rank-icon {
    @apply text-lg;
  }

  .player-info {
    @apply flex-1 min-w-0;
  }

  .player-address {
    @apply font-mono text-sm text-white font-medium;
  }

  .player-stats {
    @apply flex items-center space-x-3 mt-1;
  }

  .stat-item {
    @apply flex items-center space-x-1 text-xs;
  }

  .stat-item.winner {
    @apply text-green-400;
  }

  .stat-value {
    @apply font-semibold;
  }

  .stat-label {
    @apply text-gray-500;
  }

  .spent-amount {
    @apply text-right flex-shrink-0;
  }

  .spent-value {
    @apply font-mono text-sm text-gray-300 font-medium;
  }

  .spent-label {
    @apply text-xs text-gray-500;
  }

  .leaderboard-footer {
    @apply mt-6 text-center;
  }

  .view-all-btn {
    @apply inline-flex items-center space-x-2 text-sm;
    @apply text-blue-400 hover:text-blue-300 transition-colors;
    @apply font-medium;
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

  .no-players {
    @apply flex items-center space-x-4 p-6 text-center;
    @apply bg-gray-900/50 rounded-lg border border-gray-700;
  }

  .no-players-icon {
    @apply text-4xl opacity-50;
  }

  .no-players-text {
    @apply flex-1;
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

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .leaderboard {
      @apply p-4;
    }

    .player-row {
      @apply space-x-3 p-2;
    }

    .rank-badge {
      @apply w-6;
    }

    .rank-icon {
      @apply text-base;
    }

    .player-address {
      @apply text-xs;
    }

    .spent-value {
      @apply text-xs;
    }
  }
</style>