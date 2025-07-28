<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { db } from '../database/index.js';
  import UserDisplay from './UserDisplay.svelte';

  // Component state
  let leaderboardData = [];
  let userProfiles = new Map();
  let loading = false;
  let error = null;
  let currentUserRank = null;
  let timeFilter = 'all'; // 'all', '30d', '7d'
  let sortBy = 'successful_referrals'; // 'total_referrals', 'successful_referrals', 'success_rate'

  // Reactive statements
  $: wallet = $walletStore;
  $: if (browser && leaderboardData.length > 0 && wallet.address) {
    findCurrentUserRank();
  }

  onMount(() => {
    loadLeaderboard();
    
    // Set up real-time subscription for leaderboard updates
    const subscription = db.subscribeToReferralUpdates(() => {
      loadLeaderboard();
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  });

  async function loadLeaderboard() {
    try {
      loading = true;
      error = null;
      
      const data = await db.getReferralLeaderboard({
        timeFilter,
        sortBy,
        limit: 100
      });
      
      leaderboardData = data || [];

      // Fetch user profiles for all referrers
      if (leaderboardData.length > 0) {
        const addresses = leaderboardData.map(entry => entry.referrer_address);
        const profiles = await db.getUserProfiles(addresses);
        
        // Create a map for quick profile lookup
        userProfiles = new Map();
        profiles.forEach(profile => {
          userProfiles.set(profile.wallet_address.toLowerCase(), profile);
        });
      } else {
        userProfiles = new Map();
      }
      
    } catch (err) {
      console.error('Failed to load referral leaderboard:', err);
      error = 'Failed to load leaderboard data';
      toastStore.error('Failed to load referral leaderboard');
      userProfiles = new Map();
    } finally {
      loading = false;
    }
  }

  // Get profile for a referrer
  function getReferrerProfile(address) {
    return userProfiles.get(address.toLowerCase()) || null;
  }

  function findCurrentUserRank() {
    if (!wallet.address) return;
    
    const userIndex = leaderboardData.findIndex(
      entry => entry.referrer_address.toLowerCase() === wallet.address.toLowerCase()
    );
    
    currentUserRank = userIndex >= 0 ? userIndex + 1 : null;
  }

  function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatSuccessRate(rate) {
    return `${Math.round(rate)}%`;
  }

  function getRankIcon(rank) {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }

  function getRankClass(rank) {
    switch (rank) {
      case 1: return 'rank-gold';
      case 2: return 'rank-silver';
      case 3: return 'rank-bronze';
      default: return 'rank-default';
    }
  }

  function isCurrentUser(address) {
    return wallet.address && address.toLowerCase() === wallet.address.toLowerCase();
  }

  async function handleFilterChange() {
    await loadLeaderboard();
  }

  async function handleSortChange() {
    await loadLeaderboard();
  }
</script>

<div class="referral-leaderboard">
  <div class="leaderboard-header">
    <h2 class="leaderboard-title">
      <span class="title-icon">🏆</span>
      Referral Champions
    </h2>
    <p class="leaderboard-subtitle">
      Top referrers who are building the EthShot community
    </p>
  </div>

  <!-- Current User Rank Display -->
  {#if wallet.connected && currentUserRank}
    <div class="current-user-rank">
      <div class="rank-badge">
        <span class="rank-icon">{getRankIcon(currentUserRank)}</span>
        <span class="rank-text">Your Rank: #{currentUserRank}</span>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="leaderboard-filters">
    <div class="filter-group">
      <label for="time-filter">Time Period:</label>
      <select 
        id="time-filter" 
        bind:value={timeFilter} 
        on:change={handleFilterChange}
        class="filter-select"
      >
        <option value="all">All Time</option>
        <option value="30d">Last 30 Days</option>
        <option value="7d">Last 7 Days</option>
      </select>
    </div>

    <div class="filter-group">
      <label for="sort-by">Sort By:</label>
      <select 
        id="sort-by" 
        bind:value={sortBy} 
        on:change={handleSortChange}
        class="filter-select"
      >
        <option value="successful_referrals">Active Referrals</option>
        <option value="total_referrals">Total Referrals</option>
        <option value="success_rate">Success Rate</option>
      </select>
    </div>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading leaderboard...</p>
    </div>
  
  <!-- Error State -->
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{error}</p>
      <button class="retry-btn" on:click={loadLeaderboard}>
        Try Again
      </button>
    </div>
  
  <!-- Leaderboard Data -->
  {:else if leaderboardData.length > 0}
    <div class="leaderboard-table">
      <div class="table-header">
        <div class="header-rank">Rank</div>
        <div class="header-player">Player</div>
        <div class="header-referrals">Total</div>
        <div class="header-active">Active</div>
        <div class="header-rate">Win %</div>
      </div>

      <div class="table-body">
        {#each leaderboardData as entry, index}
          <div
            class="table-row {getRankClass(index + 1)} {isCurrentUser(entry.referrer_address) ? 'current-user' : ''}"
          >
            <div class="cell-rank">
              <span class="rank-display">{getRankIcon(index + 1)}</span>
            </div>
            
            <div class="cell-player">
              <div class="player-info">
                <UserDisplay
                  walletAddress={entry.referrer_address}
                  profile={getReferrerProfile(entry.referrer_address)}
                  size="sm"
                  showAddress={true}
                  className={isCurrentUser(entry.referrer_address) ? 'current-user' : ''}
                />
                {#if isCurrentUser(entry.referrer_address)}
                  <span class="you-badge">YOU</span>
                {/if}
              </div>
            </div>
            
            <div class="cell-referrals">
              <span class="referral-count">{entry.total_referrals}</span>
            </div>
            
            <div class="cell-active">
              <span class="active-count">{entry.successful_referrals}</span>
            </div>
            
            <div class="cell-rate">
              <span class="success-rate">{formatSuccessRate(entry.success_rate)}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Leaderboard Stats -->
    <div class="leaderboard-stats">
      <div class="stat-item">
        <span class="stat-label">Total Champions:</span>
        <span class="stat-value">{leaderboardData.length}</span>
      </div>
      
      <div class="stat-item">
        <span class="stat-label">Total Referrals:</span>
        <span class="stat-value">
          {leaderboardData.reduce((sum, entry) => sum + entry.total_referrals, 0)}
        </span>
      </div>
      
      <div class="stat-item">
        <span class="stat-label">Active Players:</span>
        <span class="stat-value">
          {leaderboardData.reduce((sum, entry) => sum + entry.successful_referrals, 0)}
        </span>
      </div>
    </div>

  <!-- Empty State -->
  {:else}
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <h3>No Champions Yet</h3>
      <p>Be the first to start referring friends and climb the leaderboard!</p>
    </div>
  {/if}
</div>

<style>
  .referral-leaderboard {
    @apply w-full max-w-6xl mx-auto p-6 space-y-6;
  }

  .leaderboard-header {
    @apply text-center space-y-2;
  }

  .leaderboard-title {
    @apply text-3xl font-bold text-white flex items-center justify-center space-x-3;
  }

  .title-icon {
    @apply text-4xl;
  }

  .leaderboard-subtitle {
    @apply text-gray-300 text-lg;
  }

  .current-user-rank {
    @apply flex justify-center;
  }

  .rank-badge {
    @apply bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 rounded-full;
    @apply flex items-center space-x-2 text-white font-bold;
  }

  .rank-icon {
    @apply text-xl;
  }

  .leaderboard-filters {
    @apply flex flex-wrap gap-4 justify-center bg-gray-800/50 p-4 rounded-xl;
  }

  .filter-group {
    @apply flex items-center space-x-2;
  }

  .filter-group label {
    @apply text-gray-300 font-medium;
  }

  .filter-select {
    @apply bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600;
    @apply focus:outline-none focus:border-blue-500;
  }

  .loading-state, .error-state, .empty-state {
    @apply text-center py-12 space-y-4;
  }

  .spinner {
    @apply w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto;
  }

  .error-icon, .empty-icon {
    @apply text-6xl;
  }

  .retry-btn {
    @apply bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors;
  }

  .leaderboard-table {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden;
    @apply border border-gray-700;
  }

  .table-header {
    @apply grid p-4 bg-gray-900/50 border-b border-gray-700;
    @apply text-gray-300 font-semibold text-sm;
    grid-template-columns: 60px 1fr 70px 70px 70px;
    gap: 16px;
  }

  .table-body {
    @apply divide-y divide-gray-700;
  }

  .table-row {
    @apply grid p-4 hover:bg-gray-700/30 transition-colors;
    grid-template-columns: 60px 1fr 70px 70px 70px;
    gap: 16px;
  }

  .table-row.current-user {
    @apply bg-blue-900/20 border-l-4 border-blue-500;
  }

  .table-row.rank-gold {
    @apply bg-gradient-to-r from-yellow-900/20 to-transparent;
  }

  .table-row.rank-silver {
    @apply bg-gradient-to-r from-gray-600/20 to-transparent;
  }

  .table-row.rank-bronze {
    @apply bg-gradient-to-r from-orange-900/20 to-transparent;
  }

  .cell-rank {
    @apply flex items-center;
  }

  .rank-display {
    @apply text-xl font-bold;
  }

  .cell-player {
    @apply flex items-center min-w-0;
  }

  .player-info {
    @apply flex items-center space-x-2 min-w-0;
    max-width: 100%;
  }

  .player-address {
    @apply text-white font-mono;
  }

  .you-badge {
    @apply bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold;
  }

  .cell-referrals, .cell-active, .cell-rate {
    @apply flex items-center justify-center text-white font-semibold;
    min-width: 70px;
  }

  .referral-count, .active-count {
    @apply text-lg;
  }

  .success-rate {
    @apply text-green-400;
  }

  .leaderboard-stats {
    @apply flex flex-wrap justify-center gap-6 bg-gray-800/30 p-4 rounded-xl;
  }

  .stat-item {
    @apply flex items-center space-x-2;
  }

  .stat-label {
    @apply text-gray-400;
  }

  .stat-value {
    @apply text-white font-bold;
  }

  .empty-state h3 {
    @apply text-xl font-bold text-white;
  }

  .empty-state p {
    @apply text-gray-400;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .referral-leaderboard {
      @apply p-4;
    }

    .leaderboard-title {
      @apply text-2xl;
    }

    .title-icon {
      @apply text-3xl;
    }

    .leaderboard-filters {
      @apply flex-col space-y-2;
    }

    .table-header, .table-row {
      grid-template-columns: 50px 1fr 60px;
      gap: 12px;
      @apply text-sm;
    }

    .header-active, .header-rate,
    .cell-active, .cell-rate {
      @apply hidden;
    }

    .leaderboard-stats {
      @apply flex-col space-y-2;
    }
  }

</style>