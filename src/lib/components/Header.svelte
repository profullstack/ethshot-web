<script>
  import { walletStore, isConnected, walletAddress, walletBalance } from '../stores/wallet.js';
  import { gameStore, currentPot } from '../stores/game.js';
  import { formatEth } from '../config.js';
  import WalletConnect from './WalletConnect.svelte';

  let showWalletModal = false;

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
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Close modal when wallet connects successfully
  $: if ($isConnected && showWalletModal) {
    showWalletModal = false;
  }
</script>

<header class="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
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
          <div class="flex items-center space-x-3">
            <!-- Wallet Info -->
            <div class="hidden sm:flex flex-col items-end text-sm">
              <span class="text-gray-400">Balance:</span>
              <span class="font-mono text-green-400">
                {parseFloat($walletBalance).toFixed(4)} ETH
              </span>
            </div>
            
            <!-- Address & Disconnect -->
            <div class="flex items-center space-x-2">
              <div class="bg-gray-800 rounded-lg px-3 py-2">
                <span class="font-mono text-sm text-gray-300">
                  {truncateAddress($walletAddress)}
                </span>
              </div>
              
              <button
                on:click={handleDisconnect}
                class="btn btn-outline text-xs px-3 py-2"
                title="Disconnect Wallet"
              >
                Disconnect
              </button>
            </div>
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