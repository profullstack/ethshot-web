<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { gameStore, currentPot } from '../stores/game-unified.js';
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { db } from '../supabase.js';
  import {
    generateReferralURL,
    copyReferralURL,
    shareReferralURL,
    shareReferralOnTwitter,
    shareReferralOnBluesky,
    formatReferralStats,
    getReferralAchievement,
    processReferralOnLoad
  } from '../utils/referral.js';

  // Component state
  let referralStats = null;
  let loading = false;
  let showShareOptions = false;
  let achievementMessage = '';

  // Reactive statements
  $: wallet = $walletStore;
  $: pot = $currentPot;
  $: formattedStats = formatReferralStats(referralStats);
  $: referralURL = formattedStats.referralCode ? generateReferralURL(formattedStats.referralCode) : '';

  // Load referral stats when wallet connects
  $: if (wallet.connected && wallet.address) {
    loadReferralStats();
  }

  // Process referral code on component mount
  onMount(() => {
    if (browser) {
      processReferralOnLoad();
    }
  });

  async function loadReferralStats() {
    if (!wallet.address) return;

    try {
      loading = true;
      const stats = await db.getReferralStats(wallet.address);
      
      // If no referral code exists, create one
      if (!stats?.referral_code) {
        await createReferralCode();
        // Reload stats after creating code
        const newStats = await db.getReferralStats(wallet.address);
        referralStats = newStats;
      } else {
        referralStats = stats;
      }

      // Check for achievements
      const achievement = getReferralAchievement(formattedStats.totalReferrals);
      if (achievement && formattedStats.totalReferrals > 0) {
        achievementMessage = achievement;
        setTimeout(() => achievementMessage = '', 5000);
      }

    } catch (error) {
      console.error('Failed to load referral stats:', error);
      toastStore.error('Failed to load referral data');
    } finally {
      loading = false;
    }
  }

  async function createReferralCode() {
    if (!wallet.address) return;

    try {
      const code = await db.createReferralCode(wallet.address);
      if (code) {
        toastStore.success('Your referral code has been created!');
      }
    } catch (error) {
      console.error('Failed to create referral code:', error);
      toastStore.error('Failed to create referral code');
    }
  }

  async function handleCopyLink() {
    if (!formattedStats.referralCode) return;

    const success = await copyReferralURL(formattedStats.referralCode);
    if (success) {
      toastStore.success('Referral link copied to clipboard!');
    } else {
      toastStore.error('Failed to copy link');
    }
  }

  async function handleNativeShare() {
    if (!formattedStats.referralCode) return;

    const success = await shareReferralURL(formattedStats.referralCode, pot);
    if (!success) {
      // Fallback to copy if native share not available
      handleCopyLink();
    }
  }

  function handleTwitterShare() {
    if (!formattedStats.referralCode) return;
    shareReferralOnTwitter(formattedStats.referralCode, pot);
  }

  function handleBlueskyShare() {
    if (!formattedStats.referralCode) return;
    shareReferralOnBluesky(formattedStats.referralCode, pot);
  }
</script>

<!-- Achievement Notification -->
{#if achievementMessage}
  <div class="achievement-notification">
    <div class="achievement-content">
      <span class="achievement-icon">🎉</span>
      <span class="achievement-text">{achievementMessage}</span>
    </div>
  </div>
{/if}

<div class="referral-system">
  <div class="referral-header">
    <h2 class="referral-title">
      <span class="title-icon">🚀</span>
      Invite Friends & Earn Discounts
    </h2>
    <p class="referral-subtitle">
      Get a 20% discount for every friend who joins and takes their first shot!
    </p>
  </div>

  {#if !wallet.connected}
    <div class="connect-prompt">
      <div class="connect-icon">👛</div>
      <p>Connect your wallet to access your referral system</p>
    </div>
  {:else if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading your referral data...</p>
    </div>
  {:else}
    <!-- Referral Stats -->
    <div class="stats-container">
      <!-- Primary stat - full width on mobile -->
      <div class="stat-card primary large">
        <div class="stat-value">{formattedStats.availableDiscounts || 0}</div>
        <div class="stat-label">Discounts Available</div>
        <div class="stat-icon">🎯</div>
      </div>
      
      <!-- Secondary stats grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{formattedStats.totalReferrals}</div>
          <div class="stat-label">Friends Invited</div>
          <div class="stat-icon">👥</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">{formattedStats.successfulReferrals}</div>
          <div class="stat-label">Active Players</div>
          <div class="stat-icon">⭐</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">{formattedStats.totalDiscountsEarned || 0}</div>
          <div class="stat-label">Total Discounts Earned</div>
          <div class="stat-icon">🏆</div>
        </div>
      </div>
    </div>

    <!-- Success Rate -->
    {#if formattedStats.totalReferrals > 0}
      <div class="success-rate">
        <div class="success-rate-label">Success Rate</div>
        <div class="success-rate-bar">
          <div class="success-rate-fill" style="width: {formattedStats.successRate}%"></div>
        </div>
        <div class="success-rate-text">{formattedStats.successRate}% of your referrals became active players</div>
      </div>
    {/if}

    <!-- Referral Code Section -->
    {#if formattedStats.referralCode}
      <div class="referral-code-section">
        <div class="code-display">
          <div class="code-label">Your Referral Code</div>
          <div class="code-value">{formattedStats.referralCode}</div>
        </div>
        
        <div class="share-buttons">
          <button class="share-btn primary" on:click={handleCopyLink}>
            <span class="btn-icon">📋</span>
            Copy Link
          </button>
          
          <button class="share-btn twitter" on:click={handleTwitterShare}>
            Share on 𝕏
          </button>
          
          <button class="share-btn bluesky" on:click={handleBlueskyShare}>
            Share on 🦋
          </button>
        </div>

        <!-- Share URL for easy copying -->
        <div class="share-url-display">
          <div class="url-label">Your Referral Link:</div>
          <input
            type="text"
            value={referralURL}
            readonly
            class="url-input"
            on:click={(e) => e.target.select()}
          />
        </div>
      </div>
    {/if}

    <!-- Referral Benefits -->
    <div class="benefits-section">
      <h3 class="benefits-title">🎁 Referral Rewards</h3>
      <div class="benefits-grid">
        <div class="benefit-card">
          <div class="benefit-icon">💰</div>
          <div class="benefit-title">20% Discount</div>
          <div class="benefit-desc">Your friend gets a 20% discount when they join</div>
        </div>
        
        <div class="benefit-card">
          <div class="benefit-icon">🚀</div>
          <div class="benefit-title">Referral Reward</div>
          <div class="benefit-desc">You get a 20% discount when they take their first shot</div>
        </div>
        
        <div class="benefit-card">
          <div class="benefit-icon">🏆</div>
          <div class="benefit-title">Leaderboard Fame</div>
          <div class="benefit-desc">Climb the referral leaderboard and earn recognition</div>
        </div>
      </div>
    </div>

    <!-- Referred By Section -->
    {#if formattedStats.referredBy}
      <div class="referred-by">
        <div class="referred-icon">🤝</div>
        <div class="referred-text">
          You were referred by <span class="referrer-address">{formattedStats.referredBy.slice(0, 6)}...{formattedStats.referredBy.slice(-4)}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .referral-system {
    @apply w-full max-w-4xl mx-auto p-6 space-y-6;
  }

  .achievement-notification {
    @apply fixed top-4 right-4 z-50;
    animation: slideInRight 0.5s ease-out, fadeOut 0.5s ease-in 4.5s forwards;
  }

  .achievement-content {
    @apply bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-lg shadow-lg;
    @apply flex items-center space-x-3;
  }

  .achievement-icon {
    @apply text-2xl;
  }

  .achievement-text {
    @apply font-bold;
  }

  .referral-header {
    @apply text-center space-y-2;
  }

  .referral-title {
    @apply text-3xl font-bold text-white flex items-center justify-center space-x-3;
  }

  .title-icon {
    @apply text-4xl;
  }

  .referral-subtitle {
    @apply text-gray-300 text-lg;
  }

  .connect-prompt {
    @apply text-center py-12 space-y-4;
  }

  .connect-icon {
    @apply text-6xl;
  }

  .loading-state {
    @apply text-center py-12 space-y-4;
  }

  .spinner {
    @apply w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto;
  }

  .stats-container {
    @apply space-y-4;
  }

  .stats-grid {
    @apply grid grid-cols-1 md:grid-cols-3 gap-4;
  }

  .stat-card {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center relative overflow-hidden;
    @apply border border-gray-700 hover:border-gray-600 transition-colors;
    @apply min-h-[100px] flex flex-col justify-center;
  }

  .stat-card.primary {
    @apply bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/50;
  }

  .stat-card.large {
    @apply md:col-span-1 p-6 min-h-[120px];
  }

  .stat-card.large .stat-value {
    @apply text-4xl md:text-5xl leading-none;
  }

  .stat-card.large .stat-label {
    @apply text-base mt-3;
  }

  .stat-value {
    @apply text-2xl md:text-3xl font-bold text-white leading-tight;
  }

  .stat-label {
    @apply text-sm text-gray-400 mt-2 leading-relaxed;
    word-wrap: break-word;
    hyphens: auto;
  }

  .stat-icon {
    @apply absolute top-2 right-2 text-2xl opacity-20;
  }

  .success-rate {
    @apply bg-gray-800/50 rounded-xl p-4 space-y-2;
  }

  .success-rate-label {
    @apply text-white font-semibold;
  }

  .success-rate-bar {
    @apply w-full h-3 bg-gray-700 rounded-full overflow-hidden;
  }

  .success-rate-fill {
    @apply h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-1000;
  }

  .success-rate-text {
    @apply text-sm text-gray-400;
  }

  .referral-code-section {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 space-y-4;
    @apply border border-gray-700;
  }

  .code-display {
    @apply text-center space-y-2;
  }

  .code-label {
    @apply text-gray-400 text-sm;
  }

  .code-value {
    @apply text-3xl font-mono font-bold text-white bg-gray-900/50 px-4 py-2 rounded-lg;
    @apply border border-gray-600;
  }

  .share-buttons {
    @apply flex flex-wrap gap-3 justify-center;
  }

  .share-btn {
    @apply px-4 py-2 rounded-lg font-semibold transition-all duration-200;
    @apply flex items-center space-x-2 min-w-[100px] justify-center;
    @apply bg-gray-700 hover:bg-gray-600 text-white;
  }

  .share-btn.primary {
    @apply bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700;
  }

  .share-btn.twitter {
    @apply bg-black hover:bg-gray-800;
  }

  .share-btn.bluesky {
    @apply bg-blue-600 hover:bg-blue-700;
  }

  .btn-icon {
    @apply text-lg;
  }

  .share-url-display {
    @apply space-y-2 pt-4 border-t border-gray-700;
  }

  .url-label {
    @apply text-sm text-gray-400 font-medium;
  }

  .url-input {
    @apply w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg;
    @apply text-white font-mono text-sm;
    @apply focus:outline-none focus:border-blue-500 cursor-pointer;
    @apply hover:border-gray-500 transition-colors;
  }

  .benefits-section {
    @apply space-y-4;
  }

  .benefits-title {
    @apply text-xl font-bold text-white text-center;
  }

  .benefits-grid {
    @apply grid grid-cols-1 gap-3;
  }

  .benefit-card {
    @apply bg-gray-800/30 rounded-xl p-4 text-center space-y-2;
    @apply border border-gray-700/50;
  }

  .benefit-icon {
    @apply text-3xl;
  }

  .benefit-title {
    @apply font-semibold text-white;
  }

  .benefit-desc {
    @apply text-sm text-gray-400;
  }

  .referred-by {
    @apply bg-green-900/20 border border-green-700/50 rounded-xl p-4;
    @apply flex items-center space-x-3 justify-center;
  }

  .referred-icon {
    @apply text-2xl;
  }

  .referred-text {
    @apply text-green-300;
  }

  .referrer-address {
    @apply font-mono font-bold text-green-200;
  }

  /* Animations */
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .referral-system {
      @apply p-4;
    }

    .referral-title {
      @apply text-2xl;
    }

    .title-icon {
      @apply text-3xl;
    }

    .stats-container {
      @apply space-y-3;
    }

    .stats-grid {
      @apply grid-cols-1 gap-3;
    }

    .stat-card.large {
      @apply min-h-[100px] p-4;
    }

    .stat-card.large .stat-value {
      @apply text-3xl leading-tight;
    }

    .stat-card.large .stat-label {
      @apply text-sm mt-2;
    }

    .stat-value {
      @apply text-xl;
    }

    .code-value {
      @apply text-2xl px-3 py-1;
    }

    .share-buttons {
      @apply grid grid-cols-2 gap-2;
    }

  }
</style>