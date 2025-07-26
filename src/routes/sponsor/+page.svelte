<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { gameStore, currentSponsor } from '$lib/stores/game-unified.js';
  import { walletStore } from '$lib/stores/wallet.js';
  import { toastStore } from '$lib/stores/toast.js';
  import { GAME_CONFIG, formatEth } from '$lib/config.js';

  let sponsorName = '';
  let sponsorLogoUrl = '';
  let sponsorUrl = '';
  let submitting = false;
  let previewMode = false;

  // Initialize game store on mount
  onMount(() => {
    gameStore.init();
  });

  // Handle sponsorship form submission
  async function handleSponsor() {
    if (!$walletStore.connected) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (!sponsorName.trim()) {
      toastStore.error('Please enter a sponsor name');
      return;
    }

    if (!sponsorLogoUrl.trim()) {
      toastStore.error('Please enter a logo URL');
      return;
    }

    // Validate logo URL format
    try {
      new URL(sponsorLogoUrl);
    } catch {
      toastStore.error('Please enter a valid logo URL');
      return;
    }

    // Validate sponsor URL format if provided
    if (sponsorUrl.trim()) {
      try {
        new URL(sponsorUrl);
      } catch {
        toastStore.error('Please enter a valid sponsor website URL');
        return;
      }
    }

    submitting = true;
    try {
      await gameStore.sponsorRound(
        sponsorName.trim(),
        sponsorLogoUrl.trim(),
        sponsorUrl.trim() || null
      );
      
      // Reset form on success
      sponsorName = '';
      sponsorLogoUrl = '';
      sponsorUrl = '';
      previewMode = false;
      
      // Redirect to main game page to see the sponsorship
      setTimeout(() => {
        goto('/');
      }, 2000);
      
    } catch (error) {
      console.error('Sponsorship failed:', error);
    } finally {
      submitting = false;
    }
  }

  // Toggle preview mode
  function togglePreview() {
    if (!sponsorName.trim() || !sponsorLogoUrl.trim()) {
      toastStore.error('Please fill in both name and logo URL to preview');
      return;
    }
    previewMode = !previewMode;
  }

  // Connect wallet if not connected
  async function connectWallet() {
    try {
      await walletStore.connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }
</script>

<svelte:head>
  <title>Sponsor - ETH Shot</title>
  <meta name="description" content="Sponsor a round of ETH Shot and get your brand seen by thousands of players!" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">
  <!-- Header -->
  <div class="text-center space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 bg-clip-text text-transparent">
      🎪 Sponsor ETH Shot
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      Get your brand seen by thousands of players and support the community!
    </p>
  </div>

  <!-- Current Sponsor Display -->
  {#if $currentSponsor && $currentSponsor.active}
    <div class="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-bold text-white">Current Sponsor</h2>
        <div class="flex items-center justify-center space-x-4">
          {#if $currentSponsor.logoUrl}
            <img
              src={$currentSponsor.logoUrl}
              alt="{$currentSponsor.name} logo"
              class="w-16 h-16 rounded-lg object-cover"
              on:error={(e) => e.target.style.display = 'none'}
            />
          {/if}
          <div>
            <h3 class="text-xl font-bold text-white">{$currentSponsor.name}</h3>
            <p class="text-purple-200">Currently sponsoring this round</p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sponsorship Form -->
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-2xl font-bold text-white mb-6 text-center">Become a Sponsor</h2>
    
    <div class="space-y-6">
      <!-- Sponsorship Benefits -->
      <div class="text-gray-300 space-y-4">
        <p class="text-center">For just <strong class="text-purple-400">{formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH</strong>, you can sponsor a round and:</p>
        <ul class="text-left max-w-md mx-auto space-y-2">
          <li>• Display your name/brand to all players</li>
          <li>• Show your logo on the game page</li>
          <li>• Drive traffic to your website (optional)</li>
          <li>• Add your contribution to the jackpot pot</li>
          <li>• Get visibility in our community</li>
        </ul>
      </div>

      <!-- Sponsor Form -->
      <form on:submit|preventDefault={handleSponsor} class="space-y-4">
        <!-- Sponsor Name -->
        <div>
          <label for="sponsorName" class="block text-sm font-medium text-gray-300 mb-2">
            Sponsor Name *
          </label>
          <input
            id="sponsorName"
            type="text"
            bind:value={sponsorName}
            placeholder="Your company or personal name"
            class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
            maxlength="50"
            required
          />
        </div>

        <!-- Logo URL -->
        <div>
          <label for="logoUrl" class="block text-sm font-medium text-gray-300 mb-2">
            Logo URL *
          </label>
          <input
            id="logoUrl"
            type="url"
            bind:value={sponsorLogoUrl}
            placeholder="https://example.com/logo.png"
            class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
            required
          />
          <p class="text-xs text-gray-500 mt-1">
            Recommended: Square image, 200x200px or larger, PNG/JPG format
          </p>
        </div>

        <!-- Sponsor Website URL -->
        <div>
          <label for="sponsorUrl" class="block text-sm font-medium text-gray-300 mb-2">
            Website URL (Optional)
          </label>
          <input
            id="sponsorUrl"
            type="url"
            bind:value={sponsorUrl}
            placeholder="https://yourwebsite.com"
            class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
          />
          <p class="text-xs text-gray-500 mt-1">
            Add your website URL to drive traffic and get more value from your sponsorship
          </p>
        </div>

        <!-- Preview Button -->
        <button
          type="button"
          on:click={togglePreview}
          class="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          disabled={!sponsorName.trim() || !sponsorLogoUrl.trim()}
        >
          {previewMode ? 'Hide Preview' : 'Preview Sponsorship'}
        </button>

        <!-- Preview -->
        {#if previewMode && sponsorName.trim() && sponsorLogoUrl.trim()}
          <div class="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <div class="text-center space-y-4">
              <h3 class="text-lg font-bold text-white">Preview</h3>
              <div class="flex items-center justify-center space-x-4">
                <img
                  src={sponsorLogoUrl}
                  alt="{sponsorName} logo"
                  class="w-12 h-12 rounded-lg object-cover"
                  on:error={(e) => {
                    e.target.style.display = 'none';
                    toastStore.error('Failed to load logo image');
                  }}
                />
                <div>
                  <h4 class="text-xl font-bold text-white">{sponsorName}</h4>
                  <p class="text-purple-200">Sponsoring this round</p>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Wallet Connection / Submit -->
        {#if !$walletStore.connected}
          <button
            type="button"
            on:click={connectWallet}
            class="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Connect Wallet to Sponsor
          </button>
        {:else}
          <div class="space-y-3">
            <div class="text-center text-sm text-gray-400">
              Connected: {$walletStore.address ? `${$walletStore.address.slice(0, 6)}...${$walletStore.address.slice(-4)}` : ''}
            </div>
            <button
              type="submit"
              disabled={submitting || !sponsorName.trim() || !sponsorLogoUrl.trim()}
              class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold disabled:cursor-not-allowed"
            >
              {#if submitting}
                <span class="flex items-center justify-center space-x-2">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sponsoring...</span>
                </span>
              {:else}
                Sponsor for {formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH
              {/if}
            </button>
          </div>
        {/if}
      </form>
    </div>
  </div>

  <!-- Additional Info -->
  <div class="grid md:grid-cols-2 gap-6">
    <a href="/" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
      <h3 class="text-xl font-bold text-white mb-2">Play Now</h3>
      <p class="text-gray-300">Try the game first</p>
    </a>

    <a href="/about" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📖</div>
      <h3 class="text-xl font-bold text-white mb-2">Learn More</h3>
      <p class="text-gray-300">About ETH Shot</p>
    </a>
  </div>

  <!-- Back Button -->
  <div class="text-center">
    <button on:click={() => goto('/')} class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold">
      ← Back to Game
    </button>
  </div>
</div>