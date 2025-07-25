<script>
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/stores/wallet.js';
  import { gameStore } from '$lib/stores/game-unified.js';
  import ReferralLeaderboard from '$lib/components/ReferralLeaderboard.svelte';
  import ReferralSystem from '$lib/components/ReferralSystem.svelte';
  import WalletConnect from '$lib/components/WalletConnect.svelte';
  import MetaTags from '$lib/components/MetaTags.svelte';

  let mounted = false;
  let showWalletModal = false;

  onMount(() => {
    mounted = true;
    gameStore.init();
    gameStore.processReferralOnLoad();
  });

  function handleConnectWallet() {
    showWalletModal = true;
  }

  function handleWalletConnected() {
    showWalletModal = false;
  }

  // Watch for wallet connection changes to close modal
  $: if ($walletStore.connected && showWalletModal) {
    handleWalletConnected();
  }
</script>

<MetaTags
  title="ETH Shot Referrals - Earn Discounts by Inviting Friends"
  description="Invite friends to ETH Shot and earn discounts! Share your referral link and climb the leaderboard. The more friends you invite, the more discounts you get!"
  keywords="ethereum, eth, referral, discount, invite, friends, viral, crypto, blockchain"
  image="/favicon-32x32.png"
  imageAlt="ETH Shot Referrals - Earn discounts"
  type="website"
  twitterCard="summary_large_image"
/>

{#if mounted}
  <div class="max-w-6xl mx-auto space-y-8">
    <!-- Header -->
    <div class="text-center space-y-4">
      <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-clip-text text-transparent flex items-center justify-center space-x-3">
        <img src="/logo.svg" alt="ETH Shot" class="w-12 h-12 md:w-16 md:h-16" />
        <span>REFERRAL SYSTEM</span>
      </h1>
      <p class="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
        Invite friends and earn <span class="text-purple-400 font-semibold">20% discounts</span>!
        Share your referral link and climb the leaderboard.
      </p>
    </div>

    <!-- Main Content -->
    <div class="grid lg:grid-cols-3 gap-8">
      <!-- Left Column - Referral System -->
      <div class="lg:col-span-2 space-y-6">
        <!-- How It Works -->
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 class="text-2xl font-bold mb-6 text-center">🚀 How Referrals Work</h2>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div class="flex items-start space-x-3">
                <span class="text-2xl">1️⃣</span>
                <div>
                  <h3 class="font-semibold text-purple-400">Get Your Link</h3>
                  <p class="text-sm text-gray-400">Connect your wallet to get a unique referral code</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <span class="text-2xl">2️⃣</span>
                <div>
                  <h3 class="font-semibold text-blue-400">Share Everywhere</h3>
                  <p class="text-sm text-gray-400">Share on social media, Discord, Telegram, anywhere!</p>
                </div>
              </div>
            </div>
            <div class="space-y-4">
              <div class="flex items-start space-x-3">
                <span class="text-2xl">3️⃣</span>
                <div>
                  <h3 class="font-semibold text-green-400">Friends Join</h3>
                  <p class="text-sm text-gray-400">When friends use your link and connect wallet</p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <span class="text-2xl">4️⃣</span>
                <div>
                  <h3 class="font-semibold text-yellow-400">Earn Rewards</h3>
                  <p class="text-sm text-gray-400">Both you and your friend get 20% discounts!</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rewards Info -->
        <div class="bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
          <h2 class="text-2xl font-bold mb-4 text-center">💎 Referral Rewards</h2>
          <div class="grid md:grid-cols-2 gap-4 text-center">
            <div class="bg-black/30 rounded-lg p-4">
              <div class="text-3xl mb-2">🎁</div>
              <h3 class="font-semibold text-purple-400">You Get</h3>
              <p class="text-2xl font-bold text-white">20% Discount</p>
              <p class="text-sm text-gray-400">For each successful referral</p>
            </div>
            <div class="bg-black/30 rounded-lg p-4">
              <div class="text-3xl mb-2">🎉</div>
              <h3 class="font-semibold text-green-400">Friend Gets</h3>
              <p class="text-2xl font-bold text-white">20% Discount</p>
              <p class="text-sm text-gray-400">Welcome bonus for joining</p>
            </div>
          </div>
          <div class="mt-4 text-center">
            <p class="text-sm text-gray-400">
              Discounts expire after 30 days. Use them or lose them!
            </p>
          </div>
        </div>

        <!-- Achievement Milestones -->
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 class="text-2xl font-bold mb-4 text-center">🏆 Achievement Milestones</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-center text-sm">
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">🎉</div>
              <div class="font-semibold">1 Referral</div>
              <div class="text-gray-400">First Blood!</div>
            </div>
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">🔥</div>
              <div class="font-semibold">5 Referrals</div>
              <div class="text-gray-400">On Fire!</div>
            </div>
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">⭐</div>
              <div class="font-semibold">10 Referrals</div>
              <div class="text-gray-400">Superstar!</div>
            </div>
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">💎</div>
              <div class="font-semibold">25 Referrals</div>
              <div class="text-gray-400">Diamond!</div>
            </div>
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">👑</div>
              <div class="font-semibold">50 Referrals</div>
              <div class="text-gray-400">Royalty!</div>
            </div>
            <div class="bg-black/30 rounded-lg p-3">
              <div class="text-2xl mb-1">🚀</div>
              <div class="font-semibold">100 Referrals</div>
              <div class="text-gray-400">To the Moon!</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column - Your Referrals & Leaderboard -->
      <div class="space-y-6">
        <!-- Your Referral System -->
        {#if $walletStore.connected}
          <ReferralSystem />
        {:else}
          <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
            <h3 class="text-lg font-bold mb-4">🔗 Get Started</h3>
            <p class="text-gray-400 mb-4">Connect your wallet to get your referral link and start earning discounts!</p>
            <button
              on:click={handleConnectWallet}
              class="inline-block bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        {/if}

        <!-- Referral Leaderboard -->
        <ReferralLeaderboard />
      </div>
    </div>

    <!-- Back to Game -->
    <div class="text-center">
      <a 
        href="/"
        class="inline-block bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-colors font-semibold"
      >
        <img src="/logo.svg" alt="ETH Shot" class="w-4 h-4" />
        <span>Back to Game</span>
      </a>
    </div>
  </div>

  <!-- Wallet Connection Modal -->
  {#if showWalletModal}
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="relative">
        <!-- Close button -->
        <button
          on:click={() => showWalletModal = false}
          class="absolute -top-2 -right-2 z-10 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
        >
          ✕
        </button>
        <WalletConnect />
      </div>
    </div>
  {/if}
{:else}
  <!-- Loading State -->
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="text-center space-y-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
      <p class="text-gray-400">Loading referral system...</p>
    </div>
  </div>
{/if}

<style>
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }
</style>