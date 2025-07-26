<script>
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { 
    activeUserCount, 
    crowdPressure, 
    fomoLevel,
    socialMetrics 
  } from '$lib/stores/social-proof.js';

  // Component props
  export let variant = 'default'; // 'default', 'compact', 'floating'
  export let showDetails = true;
  export let animated = true;

  // Component state
  let mounted = false;
  let pulseAnimation = false;

  // Reactive statements
  $: userCount = $activeUserCount;
  $: pressure = $crowdPressure;
  $: fomo = $fomoLevel;
  $: metrics = $socialMetrics;

  // Trigger pulse animation on high activity
  $: if (mounted && pressure > 100) {
    pulseAnimation = true;
    setTimeout(() => pulseAnimation = false, 2000);
  }

  onMount(() => {
    mounted = true;
  });

  /**
   * Get pressure level description
   */
  function getPressureDescription(pressureScore) {
    if (pressureScore >= 150) return 'Extremely High Activity';
    if (pressureScore >= 100) return 'High Activity';
    if (pressureScore >= 50) return 'Moderate Activity';
    if (pressureScore >= 20) return 'Low Activity';
    return 'Quiet Period';
  }

  /**
   * Get pressure color based on level
   */
  function getPressureColor(pressureScore) {
    if (pressureScore >= 150) return 'text-red-400';
    if (pressureScore >= 100) return 'text-orange-400';
    if (pressureScore >= 50) return 'text-yellow-400';
    if (pressureScore >= 20) return 'text-blue-400';
    return 'text-gray-400';
  }

  /**
   * Get background color for pressure indicator
   */
  function getPressureBgColor(pressureScore) {
    if (pressureScore >= 150) return 'bg-red-500/20 border-red-500/50';
    if (pressureScore >= 100) return 'bg-orange-500/20 border-orange-500/50';
    if (pressureScore >= 50) return 'bg-yellow-500/20 border-yellow-500/50';
    if (pressureScore >= 20) return 'bg-blue-500/20 border-blue-500/50';
    return 'bg-gray-500/20 border-gray-500/50';
  }

  /**
   * Get user count display with formatting
   */
  function formatUserCount(count) {
    if (count === 0) return 'No one';
    if (count === 1) return '1 person';
    if (count < 10) return `${count} people`;
    if (count < 100) return `${count} players`;
    return `${count}+ players`;
  }

  /**
   * Get activity emoji based on pressure
   */
  function getActivityEmoji(pressureScore) {
    if (pressureScore >= 150) return '🔥';
    if (pressureScore >= 100) return '⚡';
    if (pressureScore >= 50) return '📈';
    if (pressureScore >= 20) return '👀';
    return '😴';
  }

  /**
   * Get urgency message
   */
  function getUrgencyMessage(fomoData, userCount) {
    if (fomoData.level === 'extreme') {
      return `${formatUserCount(userCount)} playing right now!`;
    }
    if (fomoData.level === 'high') {
      return `${formatUserCount(userCount)} are active!`;
    }
    if (fomoData.level === 'medium') {
      return `${formatUserCount(userCount)} watching`;
    }
    return userCount > 0 ? `${formatUserCount(userCount)} online` : 'Be the first to play!';
  }
</script>

{#if mounted}
  <div 
    class="crowd-pressure-indicator {variant} {getPressureBgColor(pressure)}"
    class:pulse={pulseAnimation && animated}
    class:high-pressure={pressure >= 100}
  >
    {#if variant === 'floating'}
      <!-- Floating variant for overlay -->
      <div class="floating-content">
        <div class="activity-emoji">
          {getActivityEmoji(pressure)}
        </div>
        <div class="user-count-large">
          {userCount}
        </div>
        <div class="floating-label">
          online
        </div>
      </div>
    {:else if variant === 'compact'}
      <!-- Compact variant for small spaces -->
      <div class="compact-content">
        <span class="activity-emoji">{getActivityEmoji(pressure)}</span>
        <span class="user-count {getPressureColor(pressure)}">
          {userCount}
        </span>
        <span class="compact-label">online</span>
      </div>
    {:else}
      <!-- Default variant with full details -->
      <div class="default-content">
        <div class="pressure-header">
          <div class="activity-status">
            <span class="activity-emoji">{getActivityEmoji(pressure)}</span>
            <span class="pressure-title {getPressureColor(pressure)}">
              {getPressureDescription(pressure)}
            </span>
          </div>
          
          {#if showDetails}
            <div class="pressure-score">
              <span class="score-value">{Math.round(pressure)}</span>
              <span class="score-label">activity</span>
            </div>
          {/if}
        </div>

        <!-- User Count Display -->
        <div class="user-display">
          <div class="user-count-section">
            <div class="user-count-number {getPressureColor(pressure)}">
              {userCount}
            </div>
            <div class="user-count-text">
              {getUrgencyMessage(fomo, userCount)}
            </div>
          </div>
          
          {#if pressure >= 50}
            <div class="pressure-indicator">
              <div class="pressure-bar">
                <div 
                  class="pressure-fill {getPressureColor(pressure).replace('text-', 'bg-')}"
                  style="width: {Math.min(pressure, 200) / 2}%"
                ></div>
              </div>
            </div>
          {/if}
        </div>

        <!-- FOMO Message -->
        {#if showDetails && fomo.message}
          <div class="fomo-message" in:fade={{ duration: 300 }}>
            {fomo.message}
          </div>
        {/if}

        <!-- Recent Activity Stats -->
        {#if showDetails && metrics.shotsInLastHour > 0}
          <div class="activity-stats">
            <div class="stat-item">
              <span class="stat-value">{metrics.shotsInLastHour}</span>
              <span class="stat-label">shots this hour</span>
            </div>
            
            {#if metrics.lastBigWin}
              <div class="stat-item">
                <span class="stat-value">🏆</span>
                <span class="stat-label">recent winner</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .crowd-pressure-indicator {
    @apply rounded-lg border transition-all duration-300;
  }

  .crowd-pressure-indicator.default {
    @apply p-4 bg-gray-800/50 backdrop-blur-sm;
  }

  .crowd-pressure-indicator.compact {
    @apply p-2 bg-gray-800/30;
  }

  .crowd-pressure-indicator.floating {
    @apply p-3 bg-black/80 backdrop-blur-md shadow-lg;
    @apply fixed bottom-4 left-4 z-50;
  }

  .crowd-pressure-indicator.high-pressure {
    @apply shadow-lg;
  }

  .crowd-pressure-indicator.pulse {
    animation: pressurePulse 2s ease-in-out;
  }

  /* Default variant styles */
  .default-content {
    @apply space-y-3;
  }

  .pressure-header {
    @apply flex items-center justify-between;
  }

  .activity-status {
    @apply flex items-center space-x-2;
  }

  .activity-emoji {
    @apply text-xl;
  }

  .pressure-title {
    @apply font-semibold text-sm;
  }

  .pressure-score {
    @apply text-right;
  }

  .score-value {
    @apply text-lg font-bold text-white;
  }

  .score-label {
    @apply text-xs text-gray-400 block;
  }

  .user-display {
    @apply space-y-2;
  }

  .user-count-section {
    @apply flex items-center justify-between;
  }

  .user-count-number {
    @apply text-2xl font-bold;
  }

  .user-count-text {
    @apply text-sm text-gray-300 font-medium;
  }

  .pressure-indicator {
    @apply w-full;
  }

  .pressure-bar {
    @apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
  }

  .pressure-fill {
    @apply h-full transition-all duration-1000 ease-out;
  }

  .fomo-message {
    @apply text-sm text-center font-medium text-gray-200;
    @apply p-2 bg-gray-900/50 rounded-lg border border-gray-600;
  }

  .activity-stats {
    @apply flex items-center justify-between text-xs;
    @apply pt-2 border-t border-gray-700;
  }

  .stat-item {
    @apply text-center;
  }

  .stat-value {
    @apply font-bold text-white block;
  }

  .stat-label {
    @apply text-gray-400;
  }

  /* Compact variant styles */
  .compact-content {
    @apply flex items-center space-x-2;
  }

  .compact .user-count {
    @apply font-bold;
  }

  .compact-label {
    @apply text-xs text-gray-400;
  }

  /* Floating variant styles */
  .floating-content {
    @apply text-center space-y-1;
  }

  .user-count-large {
    @apply text-2xl font-bold text-white;
  }

  .floating-label {
    @apply text-xs text-gray-300;
  }

  /* Animations */
  @keyframes pressurePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .crowd-pressure-indicator.floating {
      @apply bottom-2 left-2 p-2;
    }

    .default-content {
      @apply space-y-2;
    }

    .pressure-header {
      @apply flex-col items-start space-y-1;
    }

    .user-count-number {
      @apply text-xl;
    }

    .activity-stats {
      @apply flex-col space-y-1;
    }
  }
</style>