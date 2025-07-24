<script>
  import { currentPot, gameStore } from '../stores/game.js';
  import { GAME_CONFIG, formatEth, calculateUSDValue } from '../config.js';
  import { onMount } from 'svelte';

  let animatedPot = '0.000';
  let previousPot = '0.000';

  // Animate pot value changes
  const animatePotChange = (newValue) => {
    const start = parseFloat(previousPot) || 0;
    const end = parseFloat(newValue) || 0;
    const duration = 1000; // 1 second animation
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeOut;
      
      animatedPot = formatEth(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousPot = newValue;
      }
    };

    animate();
  };

  // React to pot changes
  $: if ($currentPot !== previousPot) {
    animatePotChange($currentPot);
  }

  onMount(() => {
    animatedPot = formatEth($currentPot);
    previousPot = $currentPot;
  });
</script>

<div class="pot-display">
  <!-- Main Pot Container -->
  <div class="pot-container">
    <!-- Pot Icon/Visual -->
    <div class="pot-visual">
      <div class="pot-glow"></div>
      <div class="pot-icon">
        🏆
      </div>
      <div class="pot-sparkles">
        <span class="sparkle sparkle-1">✨</span>
        <span class="sparkle sparkle-2">💎</span>
        <span class="sparkle sparkle-3">⭐</span>
        <span class="sparkle sparkle-4">✨</span>
      </div>
    </div>

    <!-- Pot Amount -->
    <div class="pot-amount">
      <div class="pot-label">Current Jackpot</div>
      <div class="pot-value">
        <span class="pot-number">{animatedPot}</span>
        <span class="pot-currency">ETH</span>
      </div>
      <div class="pot-usd">
        ≈ ${calculateUSDValue(animatedPot)} USD
      </div>
    </div>
  </div>

  <!-- Pot Stats -->
  <div class="pot-stats">
    <div class="stat-item">
      <div class="stat-value">{GAME_CONFIG.WINNER_PAYOUT_PERCENTAGE}%</div>
      <div class="stat-label">Winner Gets</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <div class="stat-value">{GAME_CONFIG.HOUSE_FEE_PERCENTAGE}%</div>
      <div class="stat-label">House Fee</div>
    </div>
  </div>

  <!-- Progress Indicator -->
  <div class="pot-progress">
    <div class="progress-bar">
      <div class="progress-fill" style="width: {Math.min((parseFloat(animatedPot) / 1.0) * 100, 100)}%"></div>
    </div>
    <div class="progress-label">
      Next milestone: 1.000 ETH
    </div>
  </div>
</div>

<style>
  .pot-display {
    @apply w-full max-w-2xl mx-auto;
  }

  .pot-container {
    @apply relative bg-gradient-to-br from-gray-800/80 to-gray-900/80;
    @apply backdrop-blur-sm rounded-2xl border border-gray-700;
    @apply p-8 text-center;
    @apply shadow-2xl;
  }

  .pot-visual {
    @apply relative mb-6;
  }

  .pot-glow {
    @apply absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-500/20;
    @apply rounded-full blur-xl scale-150;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .pot-icon {
    @apply relative text-6xl md:text-8xl;
    @apply filter drop-shadow-lg;
    animation: float 3s ease-in-out infinite;
  }

  .pot-sparkles {
    @apply absolute inset-0;
  }

  .sparkle {
    @apply absolute text-2xl;
    animation: sparkle 2s ease-in-out infinite;
  }

  .sparkle-1 {
    @apply top-2 left-4;
    animation-delay: 0s;
  }

  .sparkle-2 {
    @apply top-4 right-6;
    animation-delay: 0.5s;
  }

  .sparkle-3 {
    @apply bottom-6 left-8;
    animation-delay: 1s;
  }

  .sparkle-4 {
    @apply bottom-2 right-4;
    animation-delay: 1.5s;
  }

  .pot-amount {
    @apply space-y-2;
  }

  .pot-label {
    @apply text-gray-400 text-sm font-medium uppercase tracking-wider;
  }

  .pot-value {
    @apply flex items-baseline justify-center space-x-2;
  }

  .pot-number {
    @apply text-4xl md:text-6xl font-black;
    @apply bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500;
    @apply bg-clip-text text-transparent;
    @apply font-mono;
    text-shadow: 0 0 30px rgba(251, 191, 36, 0.5);
  }

  .pot-currency {
    @apply text-2xl md:text-3xl font-bold text-gray-300;
  }

  .pot-usd {
    @apply text-gray-400 text-lg font-medium;
  }

  .pot-stats {
    @apply flex items-center justify-center space-x-8 mt-6;
    @apply bg-gray-900/50 rounded-xl p-4;
  }

  .stat-item {
    @apply text-center;
  }

  .stat-value {
    @apply text-2xl font-bold text-white;
  }

  .stat-label {
    @apply text-sm text-gray-400;
  }

  .stat-divider {
    @apply w-px h-12 bg-gray-600;
  }

  .pot-progress {
    @apply mt-6 space-y-2;
  }

  .progress-bar {
    @apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
  }

  .progress-fill {
    @apply h-full bg-gradient-to-r from-yellow-400 to-orange-500;
    @apply transition-all duration-1000 ease-out;
  }

  .progress-label {
    @apply text-xs text-gray-500 text-center;
  }

  /* Animations */
  @keyframes pulse-glow {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1.5);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.7);
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes sparkle {
    0%, 100% {
      opacity: 0;
      transform: scale(0.5) rotate(0deg);
    }
    50% {
      opacity: 1;
      transform: scale(1) rotate(180deg);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .pot-container {
      @apply p-6;
    }

    .pot-icon {
      @apply text-5xl;
    }

    .pot-number {
      @apply text-3xl;
    }

    .pot-currency {
      @apply text-xl;
    }

    .pot-stats {
      @apply space-x-4;
    }

    .stat-value {
      @apply text-xl;
    }
  }
</style>