<script>
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { isMobile } from '../utils/device-detection.js';
  import { onMount } from 'svelte';

  let connecting = false;
  let showMobileWallet = false;
  
  // Detect if we're on a mobile device after component mounts
  onMount(() => {
    showMobileWallet = isMobile();
    console.log('Device detection:', {
      isMobile: isMobile(),
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      showMobileWallet
    });
  });

  const handleConnect = async (walletType = 'auto') => {
    console.log('🔗 WalletConnect handleConnect called with type:', walletType);
    connecting = true;
    try {
      console.log('🔗 Calling walletStore.connect()...');
      await walletStore.connect(walletType);
      console.log('🔗 Wallet connected successfully!');
      toastStore.success('Wallet connected successfully!');
    } catch (error) {
      console.error('🔗 Failed to connect wallet:', error);
      console.error('🔗 Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        toString: error.toString()
      });
      
      // Show specific error message to user
      const errorMessage = error.message || 'Failed to connect wallet. Please try again.';
      toastStore.error(errorMessage);
    } finally {
      connecting = false;
      console.log('🔗 WalletConnect handleConnect finished');
    }
  };

  const handleInjectedConnect = () => handleConnect('injected');
  const handleWalletConnect = () => handleConnect('walletconnect');
</script>

<div class="wallet-connect">
  <div class="connect-container">
    <!-- Wallet Icon -->
    <div class="wallet-icon">
      <svg class="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
      </svg>
    </div>

    <!-- Connect Message -->
    <div class="connect-message">
      <h3 class="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
      <p class="text-gray-400 text-center max-w-md">
        Connect your Ethereum wallet to start playing ETH Shot. 
        We support MetaMask, WalletConnect, and other popular wallets.
      </p>
    </div>

    <!-- Connect Buttons -->
    <div class="connect-buttons space-y-3">
      <!-- Auto Connect (tries injected first, then WalletConnect) -->
      <button
        on:click={() => handleConnect()}
        disabled={connecting}
        class="connect-button connect-button-primary"
        style="pointer-events: auto; cursor: pointer; z-index: 1000; position: relative;"
      >
        {#if connecting}
          <div class="flex items-center space-x-3">
            <div class="spinner w-5 h-5"></div>
            <span>Connecting...</span>
          </div>
        {:else}
          <span>Connect Wallet</span>
        {/if}
      </button>

      <!-- Specific wallet options -->
      <div class="wallet-options">
        <p class="text-xs text-gray-500 mb-2">Or choose a specific option:</p>
        <div class="grid {showMobileWallet ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
          <button
            on:click={handleInjectedConnect}
            disabled={connecting}
            class="connect-button connect-button-secondary"
          >
            <span class="text-sm">Browser Wallet</span>
          </button>
          {#if showMobileWallet}
            <button
              on:click={handleWalletConnect}
              disabled={connecting}
              class="connect-button connect-button-secondary"
            >
              <span class="text-sm">Mobile Wallet</span>
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Supported Wallets -->
    <div class="supported-wallets">
      <p class="text-sm text-gray-500 mb-3">Supported wallets:</p>
      <div class="wallet-grid">
        <div class="wallet-item">
          <img src="/icons/metamask.svg" alt="MetaMask" class="w-8 h-8" />
          <span>MetaMask</span>
        </div>
        <div class="wallet-item">
          <img src="/icons/walletconnect.svg" alt="WalletConnect" class="w-8 h-8" />
          <span>WalletConnect</span>
        </div>
        <div class="wallet-item">
          <img src="/icons/coinbase.svg" alt="Coinbase Wallet" class="w-8 h-8" />
          <span>Coinbase</span>
        </div>
        <div class="wallet-item">
          <img src="/icons/trust.svg" alt="Trust Wallet" class="w-8 h-8" />
          <span>Trust</span>
        </div>
      </div>
    </div>

    <!-- Security Note -->
    <div class="security-note">
      <div class="flex items-start space-x-2">
        <svg class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
        <div class="text-sm text-gray-400">
          <p class="font-medium text-green-400 mb-1">Secure Connection</p>
          <p>We never store your private keys. Your wallet remains in your control at all times.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .wallet-connect {
    @apply flex justify-center items-center min-h-[400px];
  }

  .connect-container {
    @apply bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700;
    @apply p-8 text-center space-y-6 max-w-md w-full;
  }

  .wallet-icon {
    @apply flex justify-center mb-4;
  }

  .connect-message {
    @apply space-y-3;
  }

  .connect-button {
    @apply w-full text-white font-semibold py-4 px-6 rounded-xl;
    @apply transition-all duration-200 transform hover:scale-105;
    @apply focus:outline-none focus:ring-4;
    @apply disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none;
  }

  .connect-button-primary {
    @apply bg-gradient-to-r from-blue-500 to-blue-600;
    @apply hover:from-blue-400 hover:to-blue-500;
    @apply focus:ring-blue-500/50;
  }

  .connect-button-secondary {
    @apply bg-gradient-to-r from-gray-600 to-gray-700;
    @apply hover:from-gray-500 hover:to-gray-600;
    @apply focus:ring-gray-500/50;
    @apply py-3 text-sm;
  }

  .connect-buttons {
    @apply w-full;
  }

  .wallet-options {
    @apply mt-4;
  }

  .supported-wallets {
    @apply space-y-3;
  }

  .wallet-grid {
    @apply grid grid-cols-2 gap-3;
  }

  .wallet-item {
    @apply flex items-center space-x-2 p-2 rounded-lg;
    @apply bg-gray-700/50 border border-gray-600;
    @apply text-sm text-gray-300;
  }

  .security-note {
    @apply bg-gray-900/50 rounded-lg p-4 border border-gray-600;
  }

  .spinner {
    @apply border-2 border-gray-300 border-t-white rounded-full animate-spin;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .connect-container {
      @apply p-6 mx-4;
    }

    .wallet-grid {
      @apply grid-cols-1;
    }
  }
</style>