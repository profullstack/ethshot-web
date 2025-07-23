<script>
  import { gameStore } from '../stores/game.js';

  // Mock leaderboard data - in real app this would come from the store
  let topPlayers = [
    { address: '0x1234...5678', totalShots: 156, totalSpent: '0.156', totalWon: '2.340', rank: 1 },
    { address: '0x2345...6789', totalShots: 89, totalSpent: '0.089', totalWon: '0.000', rank: 2 },
    { address: '0x3456...7890', totalShots: 67, totalSpent: '0.067', totalWon: '1.200', rank: 3 },
    { address: '0x4567...8901', totalShots: 45, totalSpent: '0.045', totalWon: '0.000', rank: 4 },
    { address: '0x5678...9012', totalShots: 34, totalSpent: '0.034', totalWon: '0.000', rank: 5 },
  ];

  // Truncate address for display
  const truncateAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
                <span class="stat-value">+{player.totalWon}</span>
                <span class="stat-label">ETH</span>
              </span>
            {/if}
          </div>
        </div>

        <!-- Spent Amount -->
        <div class="spent-amount">
          <div class="spent-value">{player.totalSpent} ETH</div>
          <div class="spent-label">spent</div>
        </div>
      </div>
    {/each}
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