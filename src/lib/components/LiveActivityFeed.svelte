<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { 
    recentActivity, 
    activeUserCount, 
    fomoLevel,
    ACTIVITY_TYPES 
  } from '$lib/stores/social-proof.js';
  import UserDisplay from './UserDisplay.svelte';

  // Component props
  export let maxItems = 5;
  export let showHeader = true;
  export let compact = false;

  // Component state
  let mounted = false;
  let autoScroll = true;

  // Reactive statements
  $: activities = $recentActivity.slice(0, maxItems);
  $: currentFomo = $fomoLevel;

  onMount(() => {
    mounted = true;
  });

  /**
   * Get activity icon based on type
   */
  function getActivityIcon(type, intensity = 'normal') {
    const icons = {
      [ACTIVITY_TYPES.SHOT_TAKEN]: intensity === 'high' ? '🎯' : '🎲',
      [ACTIVITY_TYPES.WINNER]: '🏆',
      [ACTIVITY_TYPES.BIG_SHOT]: '💰',
      [ACTIVITY_TYPES.STREAK]: '🔥',
      [ACTIVITY_TYPES.MILESTONE]: '🚀',
      [ACTIVITY_TYPES.TRENDING]: '⚡'
    };
    return icons[type] || '📢';
  }

  /**
   * Get activity color based on type and intensity
   */
  function getActivityColor(type, intensity = 'normal') {
    if (intensity === 'high') return 'text-red-400';
    if (intensity === 'medium') return 'text-yellow-400';
    
    const colors = {
      [ACTIVITY_TYPES.SHOT_TAKEN]: 'text-blue-400',
      [ACTIVITY_TYPES.WINNER]: 'text-green-400',
      [ACTIVITY_TYPES.BIG_SHOT]: 'text-yellow-400',
      [ACTIVITY_TYPES.STREAK]: 'text-orange-400',
      [ACTIVITY_TYPES.MILESTONE]: 'text-purple-400',
      [ACTIVITY_TYPES.TRENDING]: 'text-red-400'
    };
    return colors[type] || 'text-gray-400';
  }

  /**
   * Format time ago
   */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  /**
   * Get FOMO indicator style
   */
  function getFomoStyle(level) {
    const styles = {
      extreme: 'bg-red-500 animate-pulse',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500'
    };
    return styles[level] || styles.low;
  }
</script>

{#if mounted}
  <div class="live-activity-feed" class:compact>
    {#if showHeader}
      <div class="feed-header">
        <div class="header-content">
          <h3 class="feed-title">
            <span class="title-icon">📡</span>
            Live Activity
          </h3>
          
          <!-- Active Users Counter -->
          <div class="active-users">
            <div class="user-count">
              <span class="count-number">{$activeUserCount}</span>
              <span class="count-label">online</span>
            </div>
            <div class="user-indicator {getFomoStyle(currentFomo.level)}"></div>
          </div>
        </div>
        
        <!-- FOMO Level Indicator -->
        <div class="fomo-indicator">
          <div class="fomo-bar">
            <div 
              class="fomo-fill {getFomoStyle(currentFomo.level)}"
              style="width: {Math.min(currentFomo.score, 200) / 2}%"
            ></div>
          </div>
          <div class="fomo-message">
            {currentFomo.message}
          </div>
        </div>
      </div>
    {/if}

    <!-- Activity List -->
    <div class="activity-list" class:no-header={!showHeader}>
      {#if activities.length === 0}
        <div class="empty-state">
          <div class="empty-icon">👀</div>
          <div class="empty-text">Waiting for activity...</div>
        </div>
      {:else}
        {#each activities as activity (activity.id)}
          <div 
            class="activity-item {getActivityColor(activity.type, activity.intensity)}"
            in:fly={{ x: -20, duration: 300 }}
            out:fade={{ duration: 200 }}
          >
            <div class="activity-icon">
              {getActivityIcon(activity.type, activity.intensity)}
            </div>
            
            <div class="activity-content">
              <div class="activity-message">
                {#if activity.userProfile && activity.playerAddress}
                  <UserDisplay
                    walletAddress={activity.playerAddress}
                    profile={activity.userProfile}
                    size="xs"
                    showAddress={false}
                    inline={true}
                  />
                  {activity.message.split(activity.userProfile.nickname || '')[1] || ''}
                {:else}
                  {activity.message}
                {/if}
              </div>
              
              {#if !compact}
                <div class="activity-time">
                  {formatTimeAgo(activity.timestamp)}
                </div>
              {/if}
            </div>
            
            {#if activity.intensity === 'high'}
              <div class="intensity-indicator high"></div>
            {:else if activity.intensity === 'medium'}
              <div class="intensity-indicator medium"></div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- View More Link -->
    {#if activities.length >= maxItems && !compact}
      <div class="view-more">
        <a href="/activity" class="view-more-link">
          View all activity →
        </a>
      </div>
    {/if}
  </div>
{/if}

<style>
  .live-activity-feed {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden;
  }

  .live-activity-feed.compact {
    @apply bg-transparent border-none;
  }

  .feed-header {
    @apply p-4 border-b border-gray-700 bg-gray-900/30;
  }

  .header-content {
    @apply flex items-center justify-between mb-3;
  }

  .feed-title {
    @apply text-lg font-bold text-white flex items-center space-x-2;
  }

  .title-icon {
    @apply text-xl;
  }

  .active-users {
    @apply flex items-center space-x-2;
  }

  .user-count {
    @apply text-right;
  }

  .count-number {
    @apply text-lg font-bold text-white;
  }

  .count-label {
    @apply text-xs text-gray-400 block;
  }

  .user-indicator {
    @apply w-3 h-3 rounded-full;
  }

  .fomo-indicator {
    @apply space-y-2;
  }

  .fomo-bar {
    @apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
  }

  .fomo-fill {
    @apply h-full transition-all duration-1000 ease-out;
  }

  .fomo-message {
    @apply text-sm text-gray-300 text-center font-medium;
  }

  .activity-list {
    @apply p-4 space-y-3 max-h-80 overflow-y-auto;
  }

  .activity-list.no-header {
    @apply p-2 max-h-60;
  }

  .compact .activity-list {
    @apply p-0 space-y-2 max-h-40;
  }

  .empty-state {
    @apply text-center py-8 text-gray-500;
  }

  .empty-icon {
    @apply text-3xl mb-2;
  }

  .empty-text {
    @apply text-sm;
  }

  .activity-item {
    @apply flex items-start space-x-3 p-3 rounded-lg bg-gray-900/30 border border-gray-700/50;
    @apply hover:bg-gray-700/30 transition-colors relative;
  }

  .compact .activity-item {
    @apply p-2 bg-transparent border-none;
  }

  .activity-icon {
    @apply text-lg flex-shrink-0 mt-0.5;
  }

  .compact .activity-icon {
    @apply text-base;
  }

  .activity-content {
    @apply flex-1 min-w-0;
  }

  .activity-message {
    @apply text-sm font-medium leading-relaxed;
    word-wrap: break-word;
  }

  .compact .activity-message {
    @apply text-xs;
  }

  .activity-time {
    @apply text-xs text-gray-500 mt-1;
  }

  .intensity-indicator {
    @apply absolute top-2 right-2 w-2 h-2 rounded-full;
  }

  .intensity-indicator.high {
    @apply bg-red-500 animate-pulse;
  }

  .intensity-indicator.medium {
    @apply bg-yellow-500;
  }

  .view-more {
    @apply p-4 border-t border-gray-700 bg-gray-900/20;
  }

  .view-more-link {
    @apply text-sm text-blue-400 hover:text-blue-300 transition-colors;
  }

  /* Custom scrollbar */
  .activity-list::-webkit-scrollbar {
    width: 4px;
  }

  .activity-list::-webkit-scrollbar-track {
    @apply bg-gray-800;
  }

  .activity-list::-webkit-scrollbar-thumb {
    @apply bg-gray-600 rounded-full;
  }

  .activity-list::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-500;
  }

  /* Animations */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .feed-header {
      @apply p-3;
    }

    .activity-list {
      @apply p-3 max-h-60;
    }

    .activity-item {
      @apply p-2;
    }

    .feed-title {
      @apply text-base;
    }

    .title-icon {
      @apply text-lg;
    }
  }
</style>