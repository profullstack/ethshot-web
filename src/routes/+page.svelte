<script>
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/stores/wallet.js';
  import { gameStore, winnerEventStore } from '$lib/stores/game/index.js';
  import { shotResultMessageStore, hideShotResultMessage } from '$lib/stores/shot-result-message.js';
  import { debugMode } from '$lib/stores/debug.js';
  import { GAME_CONFIG, NETWORK_CONFIG, formatEth, formatCooldownTime } from '$lib/config.js';
  import EthShotGameButton from '$lib/components/EthShotGameButton.svelte';
  import PotDisplay from '$lib/components/PotDisplay.svelte';
  import Leaderboard from '$lib/components/Leaderboard.svelte';
  import SponsorBanner from '$lib/components/SponsorBanner.svelte';
  import RecentWinners from '$lib/components/RecentWinners.svelte';
  import WalletConnect from '$lib/components/WalletConnect.svelte';
  import WinnerAnimation from '$lib/components/WinnerAnimation.svelte';
  import NotificationPermission from '$lib/components/NotificationPermission.svelte';
  import MetaTags from '$lib/components/MetaTags.svelte';
  import ReferralSystem from '$lib/components/ReferralSystem.svelte';
  import DiscountButton from '$lib/components/DiscountButton.svelte';
  import AdminPanel from '$lib/components/AdminPanel.svelte';
  import SimplePendingShotManager from '$lib/components/SimplePendingShotManager.svelte';
  import ShotResultMessage from '$lib/components/ShotResultMessage.svelte';
  
  // Social Proof Components
  import LiveActivityFeed from '$lib/components/LiveActivityFeed.svelte';
  import CrowdPressureIndicator from '$lib/components/CrowdPressureIndicator.svelte';
  import FomoAlert from '$lib/components/FomoAlert.svelte';
  
  // Social Proof Integration
  import {
    initializeSocialProofIntegration,
    handleUserActivity,
    subscribeSocialProofUpdates,
    stopSocialProofIntegration
  } from '$lib/stores/game/social-proof-integration.js';

  let mounted = false;
  let showWinnerAnimation = false;
  let winnerAmount = '0';
  let socialProofSubscription = null;

  // Listen for winner events from the winner event store
  $: if ($winnerEventStore) {
    const winnerEvent = $winnerEventStore;
    const currentUser = $walletStore.address;
    
    console.log('🎉 Winner event detected:', {
      winnerEvent,
      currentUser,
      winnerAddress: winnerEvent.winner,
      amount: winnerEvent.amount,
      isCurrentUser: winnerEvent.winner?.toLowerCase() === currentUser?.toLowerCase()
    });
    
    // Check if the winner is the current user (allow for wallet address to be available later)
    if (winnerEvent.winner && currentUser && winnerEvent.winner.toLowerCase() === currentUser.toLowerCase()) {
      winnerAmount = winnerEvent.amount || '0';
      showWinnerAnimation = true;
      
      console.log('🎊 Triggering winner animation:', {
        winnerAmount,
        showWinnerAnimation
      });
      
      // Clear the winner event after showing animation (longer delay to ensure animation triggers)
      setTimeout(() => {
        console.log('🧹 Clearing winner event');
        winnerEventStore.set(null);
      }, 1000);
    } else if (winnerEvent.winner && !currentUser) {
      // Wallet not connected yet, but winner event exists - wait for wallet
      console.log('⏳ Winner event exists but wallet not connected yet, waiting...');
    } else if (winnerEvent.winner && currentUser && winnerEvent.winner.toLowerCase() !== currentUser.toLowerCase()) {
      // Someone else won
      console.log('👥 Someone else won the pot:', winnerEvent.winner);
    }
  }

  const handleAnimationComplete = () => {
    showWinnerAnimation = false;
  };

  onMount(async () => {
    mounted = true;
    // Initialize game store for real-time updates
    gameStore.init();
    // Process any referral code from URL
    const { ReferralService } = await import('$lib/stores/game/index.js');
    ReferralService.processReferralOnLoad();
    
    // Initialize social proof system
    await initializeSocialProofIntegration();
    
    // Subscribe to real-time social proof updates
    socialProofSubscription = subscribeSocialProofUpdates();
    
    // Track user activity if wallet is connected
    if ($walletStore.connected && $walletStore.address) {
      await handleUserActivity($walletStore.address, 'login');
    }
    
    return () => {
      // Cleanup on component destroy
      if (socialProofSubscription) {
        socialProofSubscription.unsubscribe();
      }
      stopSocialProofIntegration();
    };
  });
  
  // Track user activity when wallet connects
  $: if (mounted && $walletStore.connected && $walletStore.address) {
    handleUserActivity($walletStore.address, 'login');
  }
</script>

<MetaTags
  title="ETH Shot - Take Your Shot at the ETH Jackpot"
  description="A viral, pay-to-play, Ethereum-powered game where users take a chance to win an ETH jackpot by clicking a single button. {formatEth(GAME_CONFIG.SHOT_COST)} ETH per shot, {GAME_CONFIG.WIN_PERCENTAGE}% chance to win!"
  keywords="ethereum, eth, jackpot, game, crypto, blockchain, gambling, web3, defi, shot, viral, pay-to-play"
  image="/favicon-32x32.png"
  imageAlt="ETH Shot - Take your shot at the ETH jackpot"
  type="website"
  twitterCard="summary_large_image"
/>

{#if mounted}
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Hero Section -->
    <div class="text-center space-y-6">
      <div class="space-y-4">
        <h1 class="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 bg-clip-text text-transparent animate-pulse">
          ETH SHOT
        </h1>
        <p class="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
          Take your shot at the ETH jackpot!
          <span class="text-yellow-400 font-semibold">{formatEth(GAME_CONFIG.SHOT_COST)} ETH</span> per shot,
          <span class="text-green-400 font-semibold">{GAME_CONFIG.WIN_PERCENTAGE}% chance</span> to win the pot.
        </p>
      </div>

      <!-- Sponsor Banner -->
      <SponsorBanner />
    </div>

    <!-- Main Game Area -->
    <div class="grid lg:grid-cols-3 gap-8">
      <!-- Left Column - Game Controls -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Pot Display -->
        <PotDisplay />
        
        <!-- Game Button -->
        <div class="flex justify-center space-x-4">
          {#if $walletStore.connected}
            <EthShotGameButton />
            {#if $gameStore.availableDiscounts?.length > 0}
              <DiscountButton />
            {/if}
          {:else}
            <WalletConnect />
          {/if}
        </div>

        <!-- Pending Shot Manager -->
        {#if $walletStore.connected}
          {#if $debugMode}
            <div class="debug-info">
              <p>Debug: Wallet connected = {$walletStore.connected}</p>
              <p>Debug: Wallet address = {$walletStore.address}</p>
            </div>
          {/if}
          <SimplePendingShotManager />
        {:else}
          {#if $debugMode}
            <div class="debug-info">
              <p>Debug: Wallet NOT connected</p>
            </div>
          {/if}
        {/if}

        <!-- Game Rules -->
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 class="text-xl font-bold mb-4 text-center flex items-center justify-center space-x-2">
            <img src="/logo.svg" alt="ETH Shot" class="w-5 h-5" />
            <span>How to Play</span>
          </h3>
          <div class="grid md:grid-cols-2 gap-4 text-sm">
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <span class="text-green-400">✓</span>
                <span>Connect your wallet</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-green-400">✓</span>
                <span>Pay {formatEth(GAME_CONFIG.SHOT_COST)} ETH per shot</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-green-400">✓</span>
                <span>{GAME_CONFIG.WIN_PERCENTAGE}% chance to win per click</span>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <span class="text-yellow-400">⚡</span>
                <span>Winner gets {GAME_CONFIG.WINNER_PERCENTAGE}% of pot</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-blue-400">⏰</span>
                <span>{formatCooldownTime(GAME_CONFIG.COOLDOWN_HOURS)} cooldown per wallet</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-purple-400">🎪</span>
                <span>Sponsor rounds available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column - Stats & Leaderboard -->
      <div class="space-y-6">
        <!-- Social Proof Section -->
        <div class="space-y-4">
          <!-- Crowd Pressure Indicator -->
          <CrowdPressureIndicator />
          
          <!-- Live Activity Feed -->
          <LiveActivityFeed maxItems={5} />
        </div>
        
        <!-- Recent Winners -->
        <RecentWinners />
        
        <!-- Leaderboard -->
        <Leaderboard />
        
        <!-- Player Stats -->
        {#if $walletStore.connected}
          <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h3 class="text-lg font-bold mb-4">📊 Your Stats</h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-400">Total Shots:</span>
                <span class="font-mono">{$gameStore.playerStats?.totalShots || 0}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Total Spent:</span>
                <span class="font-mono">{$gameStore.playerStats?.totalSpent || '0.000'} ETH</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Total Won:</span>
                <span class="font-mono text-green-400">{$gameStore.playerStats?.totalWon || '0.000'} ETH</span>
              </div>
              {#if $gameStore.referralStats?.totalReferrals > 0}
                <div class="flex justify-between">
                  <span class="text-gray-400">Referrals:</span>
                  <span class="font-mono text-blue-400">{$gameStore.referralStats.totalReferrals}</span>
                </div>
              {/if}
              {#if $gameStore.cooldownRemaining > 0}
                <div class="flex justify-between">
                  <span class="text-gray-400">Next Shot:</span>
                  <span class="font-mono text-yellow-400">{Math.ceil($gameStore.cooldownRemaining / 60)}m</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Admin Panel (Owner Only) -->
        {#if $walletStore.connected}
          <AdminPanel />
        {/if}

        <!-- Referral System -->
        {#if $walletStore.connected}
          <ReferralSystem />
        {/if}

        <!-- Social Sharing -->
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 class="text-lg font-bold mb-4">📱 Share ETH Shot</h3>
          <div class="space-y-3">
            <button
              class="w-full bg-black hover:bg-gray-900 text-white py-2 px-4 rounded-lg transition-colors text-sm border border-gray-700"
              on:click={async () => {
                const { SocialActions } = await import('../lib/stores/game/index.js');
                const { gameStore } = await import('../lib/stores/game/index.js');
                const gameState = gameStore.getGameState();
                SocialActions.shareOnTwitter({
                  currentPot: gameState.currentPot,
                  activeCrypto: gameState.activeCrypto
                });
              }}
            >
              Share on 𝕏
            </button>
            <button
              class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
              on:click={async () => {
                const { SocialActions } = await import('../lib/stores/game/index.js');
                await SocialActions.copyLink();
              }}
            >
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Contract Info -->
    <div class="text-center text-xs text-gray-500 space-y-2">
      <p>
        Smart Contract: 
        <a
          href="{NETWORK_CONFIG.BLOCK_EXPLORER_URL}/address/{NETWORK_CONFIG.CONTRACT_ADDRESS}"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-400 hover:text-blue-300 font-mono"
        >
          {NETWORK_CONFIG.CONTRACT_ADDRESS?.slice(0, 6)}...{NETWORK_CONFIG.CONTRACT_ADDRESS?.slice(-4)}
        </a>
      </p>
      <p>All transactions are on-chain and verifiable. Play responsibly.</p>
    </div>
  </div>
{:else}
  <!-- Loading State -->
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center space-y-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
      <p class="text-gray-400">Loading ETH Shot...</p>
    </div>
  </div>
{/if}

<!-- Winner Animation Overlay -->
<WinnerAnimation
  show={showWinnerAnimation}
  amount={winnerAmount}
  on:complete={handleAnimationComplete}
/>

<!-- Shot Result Message Overlay -->
<ShotResultMessage
  show={$shotResultMessageStore.show}
  result={$shotResultMessageStore.result}
  on:close={hideShotResultMessage}
/>

<!-- Notification Permission Component -->
<NotificationPermission />

<!-- FOMO Alert Component -->
<FomoAlert position="top-right" />

<style>
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>