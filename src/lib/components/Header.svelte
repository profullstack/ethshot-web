<script>
  import { walletStore, isConnected, walletAddress, walletBalance } from '../stores/wallet.js';
  import { gameStore, currentPot } from '../stores/game-unified.js';
  import { displayName, avatarUrl, userProfile } from '../stores/profile.js';
  import { formatEth } from '../config.js';
  import WalletConnect from './WalletConnect.svelte';
  import UserProfile from './UserProfile.svelte';

  let showWalletModal = false;
  let showWalletDropdown = false;
  let showProfileModal = false;

  // Truncate address for display
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle wallet connection - show modal
  const handleConnect = () => {
    showWalletModal = true;
  };

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await walletStore.disconnect();
      showWalletDropdown = false;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Handle profile modal
  const handleEditProfile = () => {
    showProfileModal = true;
    showWalletDropdown = false;
  };

  // Toggle wallet dropdown
  const toggleWalletDropdown = () => {
    showWalletDropdown = !showWalletDropdown;
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (showWalletDropdown && !event.target.closest('.wallet-dropdown-container')) {
      showWalletDropdown = false;
    }
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if ($walletAddress) {
      try {
        await navigator.clipboard.writeText($walletAddress);
        // You could add a toast notification here
        console.log('Address copied to clipboard');
      } catch (error) {
        console.error('Failed to copy address:', error);
      }
    }
  };

  // Close modal when wallet connects successfully
  $: if ($isConnected && showWalletModal) {
    showWalletModal = false;
  }
</script>

<header class="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800" on:click={handleClickOutside}>
  <div class="container mx-auto px-4 py-4">
    <div class="flex items-center justify-between">
      <!-- Logo -->
      <div class="flex items-center space-x-4">
        <a href="/" class="flex items-center space-x-2">
          <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-lg">🎯</span>
          </div>
          <span class="text-xl font-bold gradient-text">ETH SHOT</span>
        </a>
        
        <!-- Current Pot Display -->
        <div class="hidden md:flex items-center space-x-2 bg-gray-800/50 rounded-lg px-3 py-1">
          <span class="text-sm text-gray-400">Pot:</span>
          <span class="font-mono text-yellow-400 font-semibold">
            {formatEth($currentPot)} ETH
          </span>
        </div>
      </div>

      <!-- Navigation & Wallet -->
      <div class="flex items-center space-x-4">
        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center space-x-6">
          <a
            href="/"
            class="text-gray-300 hover:text-white transition-colors"
          >
            Game
          </a>
          <a
            href="/referrals"
            class="text-gray-300 hover:text-purple-400 transition-colors font-semibold"
          >
            🎯 Referrals
          </a>
          <a
            href="/leaderboard"
            class="text-gray-300 hover:text-white transition-colors"
          >
            Leaderboard
          </a>
          <a
            href="/about"
            class="text-gray-300 hover:text-white transition-colors"
          >
            About
          </a>
        </nav>

        <!-- Wallet Connection -->
        {#if $isConnected}
          <div class="wallet-dropdown-container relative">
            <!-- Wallet Button -->
            <button
              on:click={toggleWalletDropdown}
              class="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
            >
              <!-- Avatar or Wallet Icon -->
              {#if $avatarUrl}
                <img
                  src={$avatarUrl}
                  alt="Profile avatar"
                  class="w-6 h-6 rounded-full object-cover border border-gray-600"
                />
              {:else}
                <div class="w-6 h-6 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs">👤</span>
                </div>
              {/if}
              
              <!-- Display Name or Address -->
              <span class="font-mono text-sm text-gray-300">
                {$displayName}
              </span>
              
              <!-- Balance (hidden on mobile) -->
              <span class="hidden sm:block font-mono text-xs text-green-400">
                {parseFloat($walletBalance).toFixed(4)} ETH
              </span>
              
              <!-- Dropdown Arrow -->
              <svg
                class="w-4 h-4 text-gray-400 transition-transform {showWalletDropdown ? 'rotate-180' : ''}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <!-- Dropdown Menu -->
            {#if showWalletDropdown}
              <div class="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                <!-- Profile Info Header -->
                <div class="px-4 py-3 border-b border-gray-700">
                  <div class="flex items-center space-x-3 mb-3">
                    {#if $avatarUrl}
                      <img
                        src={$avatarUrl}
                        alt="Profile avatar"
                        class="w-10 h-10 rounded-full object-cover border-2 border-gray-600"
                      />
                    {:else}
                      <div class="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                        <span class="text-white text-lg">👤</span>
                      </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <div class="text-white font-semibold truncate">
                        {$displayName}
                      </div>
                      {#if $userProfile?.bio}
                        <div class="text-xs text-gray-400 truncate mt-1">
                          {$userProfile.bio}
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <!-- Wallet Address -->
                  <div class="space-y-1">
                    <span class="text-xs text-gray-400">Wallet Address:</span>
                    <div class="flex items-center space-x-2">
                      <span class="font-mono text-xs text-gray-300 break-all">
                        {$walletAddress}
                      </span>
                      <button
                        on:click={copyAddress}
                        class="text-blue-400 hover:text-blue-300 text-xs"
                        title="Copy Address"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  
                  <!-- Balance -->
                  <div class="mt-2">
                    <span class="text-xs text-gray-400">Balance:</span>
                    <div class="font-mono text-green-400 font-semibold">
                      {parseFloat($walletBalance).toFixed(6)} ETH
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="p-2 space-y-1">
                  <button
                    on:click={handleEditProfile}
                    class="w-full flex items-center space-x-2 px-3 py-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors text-sm"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    <span>Edit Profile</span>
                  </button>
                  
                  <button
                    on:click={handleDisconnect}
                    class="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <button
            on:click={handleConnect}
            class="btn btn-primary px-6 py-2"
          >
            Connect Wallet
          </button>
        {/if}

        <!-- Mobile Menu Button -->
        <button class="md:hidden p-2 text-gray-400 hover:text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Pot Display -->
    <div class="md:hidden mt-3 flex justify-center">
      <div class="bg-gray-800/50 rounded-lg px-4 py-2">
        <span class="text-sm text-gray-400">Current Pot: </span>
        <span class="font-mono text-yellow-400 font-semibold text-lg">
          {formatEth($currentPot)} ETH
        </span>
      </div>
    </div>
  </div>
</header>

<!-- Wallet Connection Modal -->
{#if showWalletModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" on:click={() => showWalletModal = false}>
    <div class="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4" on:click|stopPropagation>
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold text-white">Connect Wallet</h2>
        <button
          on:click={() => showWalletModal = false}
          class="text-gray-400 hover:text-white"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <WalletConnect />
    </div>
  </div>
{/if}

<!-- User Profile Modal -->
<UserProfile bind:show={showProfileModal} on:close={() => showProfileModal = false} />

<style>
  .gradient-text {
    background: linear-gradient(135deg, #ff4444, #8b5cf6, #fbbf24);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradientShift 3s ease infinite;
  }

  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>