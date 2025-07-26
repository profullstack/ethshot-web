<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { 
    fomoLevel, 
    potGrowthRate, 
    socialMetrics,
    liveActivity,
    ACTIVITY_TYPES 
  } from '$lib/stores/social-proof.js';
  import { currentPot } from '$lib/stores/game/index.js';

  // Component props
  export let position = 'top-right'; // 'top-right', 'top-center', 'bottom-right'
  export let autoHide = true;
  export let duration = 5000; // Auto-hide duration in ms

  // Component state
  let mounted = false;
  let alerts = [];
  let alertCounter = 0;
  let potGrowthTimer = null;
  let lastPotAmount = 0;

  // Reactive statements
  $: fomo = $fomoLevel;
  $: growthRate = $potGrowthRate;
  $: metrics = $socialMetrics;
  $: pot = $currentPot;
  $: activity = $liveActivity;

  // Watch for pot growth
  $: if (mounted && pot && parseFloat(pot) !== lastPotAmount) {
    handlePotGrowth(parseFloat(pot));
    lastPotAmount = parseFloat(pot);
  }

  // Watch for trending moments
  $: if (mounted && metrics.trendingMoment) {
    showTrendingAlert(metrics.trendingMoment);
  }

  // Watch for FOMO level changes
  $: if (mounted && fomo.level === 'extreme') {
    showFomoAlert();
  }

  onMount(() => {
    mounted = true;
    if (pot) {
      lastPotAmount = parseFloat(pot);
    }
  });

  onDestroy(() => {
    if (potGrowthTimer) {
      clearTimeout(potGrowthTimer);
    }
  });

  /**
   * Handle pot growth detection
   */
  function handlePotGrowth(newAmount) {
    const growth = newAmount - lastPotAmount;
    
    if (growth > 0.01) { // Significant growth (0.01 ETH+)
      showPotGrowthAlert(growth, newAmount);
    }
    
    // Check for milestones
    checkPotMilestones(newAmount);
  }

  /**
   * Check for pot milestones
   */
  function checkPotMilestones(amount) {
    const milestones = [1, 2, 5, 10, 20, 50, 100];
    
    for (const milestone of milestones) {
      if (amount >= milestone && lastPotAmount < milestone) {
        showMilestoneAlert(milestone);
        break;
      }
    }
  }

  /**
   * Show pot growth alert
   */
  function showPotGrowthAlert(growth, totalPot) {
    addAlert({
      type: 'pot-growth',
      title: '📈 Pot Growing!',
      message: `+${growth.toFixed(3)} ETH added! Now ${totalPot.toFixed(3)} ETH`,
      urgency: growth > 0.05 ? 'high' : 'medium',
      icon: '💰',
      duration: 4000
    });
  }

  /**
   * Show milestone alert
   */
  function showMilestoneAlert(milestone) {
    addAlert({
      type: 'milestone',
      title: '🚀 Milestone Reached!',
      message: `Pot hit ${milestone} ETH! The excitement is building!`,
      urgency: 'high',
      icon: '🎯',
      duration: 6000,
      action: {
        text: 'Take Your Shot!',
        callback: () => scrollToGameButton()
      }
    });
  }

  /**
   * Show trending alert
   */
  function showTrendingAlert(trendingData) {
    addAlert({
      type: 'trending',
      title: '🔥 Viral Moment!',
      message: `${trendingData.shotCount} shots in ${Math.round(trendingData.timeSpan / 1000)}s!`,
      urgency: 'extreme',
      icon: '⚡',
      duration: 7000,
      action: {
        text: 'Join the Action!',
        callback: () => scrollToGameButton()
      }
    });
  }

  /**
   * Show FOMO alert
   */
  function showFomoAlert() {
    addAlert({
      type: 'fomo',
      title: '⚡ Peak Activity!',
      message: 'Everyone is playing right now! Don\'t miss out!',
      urgency: 'extreme',
      icon: '🔥',
      duration: 5000,
      action: {
        text: 'Play Now!',
        callback: () => scrollToGameButton()
      }
    });
  }

  /**
   * Add alert to queue
   */
  function addAlert(alertData) {
    const alert = {
      id: ++alertCounter,
      timestamp: Date.now(),
      ...alertData
    };

    alerts = [...alerts, alert];

    // Auto-hide if enabled
    if (autoHide && alert.duration) {
      setTimeout(() => {
        removeAlert(alert.id);
      }, alert.duration);
    }
  }

  /**
   * Remove alert
   */
  function removeAlert(alertId) {
    alerts = alerts.filter(alert => alert.id !== alertId);
  }

  /**
   * Scroll to game button
   */
  function scrollToGameButton() {
    const gameButton = document.querySelector('.game-button, [data-game-button]');
    if (gameButton) {
      gameButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Get alert style based on urgency
   */
  function getAlertStyle(urgency) {
    const styles = {
      extreme: 'bg-red-500/90 border-red-400 text-white',
      high: 'bg-orange-500/90 border-orange-400 text-white',
      medium: 'bg-yellow-500/90 border-yellow-400 text-black',
      low: 'bg-blue-500/90 border-blue-400 text-white'
    };
    return styles[urgency] || styles.low;
  }

  /**
   * Get position classes
   */
  function getPositionClasses() {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
      'bottom-right': 'bottom-4 right-4'
    };
    return positions[position] || positions['top-right'];
  }
</script>

{#if mounted && alerts.length > 0}
  <div class="fomo-alerts {getPositionClasses()}">
    {#each alerts as alert (alert.id)}
      <div 
        class="fomo-alert {getAlertStyle(alert.urgency)}"
        class:extreme={alert.urgency === 'extreme'}
        in:fly={{ x: 300, duration: 400 }}
        out:fade={{ duration: 300 }}
      >
        <!-- Alert Icon -->
        <div class="alert-icon">
          {alert.icon}
        </div>

        <!-- Alert Content -->
        <div class="alert-content">
          <div class="alert-title">
            {alert.title}
          </div>
          <div class="alert-message">
            {alert.message}
          </div>
          
          {#if alert.action}
            <button 
              class="alert-action"
              on:click={() => {
                alert.action.callback();
                removeAlert(alert.id);
              }}
            >
              {alert.action.text}
            </button>
          {/if}
        </div>

        <!-- Close Button -->
        <button 
          class="alert-close"
          on:click={() => removeAlert(alert.id)}
          title="Dismiss"
        >
          ×
        </button>

        <!-- Urgency Indicator -->
        {#if alert.urgency === 'extreme'}
          <div class="urgency-pulse"></div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .fomo-alerts {
    @apply fixed z-50 space-y-3 max-w-sm;
  }

  .fomo-alert {
    @apply relative flex items-start space-x-3 p-4 rounded-lg border-2;
    @apply backdrop-blur-md shadow-lg;
    @apply transform transition-all duration-300;
  }

  .fomo-alert.extreme {
    animation: extremePulse 2s infinite;
  }

  .alert-icon {
    @apply text-2xl flex-shrink-0 mt-0.5;
  }

  .alert-content {
    @apply flex-1 min-w-0;
  }

  .alert-title {
    @apply font-bold text-sm leading-tight;
  }

  .alert-message {
    @apply text-sm mt-1 leading-relaxed;
  }

  .alert-action {
    @apply mt-2 px-3 py-1 bg-white/20 hover:bg-white/30;
    @apply rounded-md text-xs font-semibold transition-colors;
    @apply border border-white/30;
  }

  .alert-close {
    @apply absolute top-2 right-2 w-6 h-6 flex items-center justify-center;
    @apply text-lg font-bold opacity-70 hover:opacity-100;
    @apply transition-opacity cursor-pointer;
  }

  .urgency-pulse {
    @apply absolute -inset-1 rounded-lg border-2 border-red-400;
    animation: urgencyPulse 1.5s infinite;
    pointer-events: none;
  }

  /* Animations */
  @keyframes extremePulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
  }

  @keyframes urgencyPulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.1);
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .fomo-alerts {
      @apply max-w-xs left-4 right-4;
      max-width: calc(100vw - 2rem);
    }

    .fomo-alert {
      @apply p-3;
    }

    .alert-icon {
      @apply text-xl;
    }

    .alert-title {
      @apply text-xs;
    }

    .alert-message {
      @apply text-xs;
    }

    .alert-action {
      @apply text-xs px-2 py-1;
    }
  }

  /* Position-specific adjustments */
  .fomo-alerts.top-center {
    @apply left-1/2 transform -translate-x-1/2;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .fomo-alert {
      @apply border-4;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .fomo-alert.extreme {
      animation: none;
    }
    
    .urgency-pulse {
      animation: none;
      @apply opacity-50;
    }
  }
</style>