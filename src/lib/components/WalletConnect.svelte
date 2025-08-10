<script>
  import { walletStore } from '../stores/wallet.js';
  import { toastStore } from '../stores/toast.js';
  import { isMobile } from '../utils/device-detection.js';
  import { isCorrectNetwork } from '../utils/network-detection.js';
  import NetworkSwitchPrompt from './NetworkSwitchPrompt.svelte';
  import { NETWORK_CONFIG } from '../config.js';
  import { onMount } from 'svelte';

  let connecting = false;
  let showMobileWallet = false;
  let isIOS = false;
  let hasMetaMask = false;
  let hasPhantom = false;
  let showNetworkPrompt = false;
  let walletConnected = false;
  
  // Subscribe to wallet store to detect connection status
  $: walletConnected = $walletStore.isConnected;
  
  // Detect if we're on a mobile device after component mounts
  onMount(() => {
    showMobileWallet = isMobile();
    isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    hasMetaMask = !!window.ethereum?.isMetaMask;
    hasPhantom = !!window.ethereum?.isPhantom;
    
    console.log('Device detection:', {
      isMobile: isMobile(),
      isIOS,
      hasMetaMask,
      hasPhantom,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      showMobileWallet,
      ethereumProviders: window.ethereum ? Object.keys(window.ethereum) : 'none'
    });
  });

  // Check network after wallet connection
  const checkNetworkAfterConnection = async () => {
    if (walletConnected) {
      try {
        const isCorrect = await isCorrectNetwork();
        if (!isCorrect) {
          showNetworkPrompt = true;
          toastStore.warning(`Please switch to ${NETWORK_CONFIG.NETWORK_NAME} to see the current pot and play the game.`);
        }
      } catch (error) {
        console.warn('Failed to check network after connection:', error);
      }
    }
  };

  // Watch for wallet connection changes
  $: if (walletConnected) {
    checkNetworkAfterConnection();
  }

  // Handle successful network switch
  const handleNetworkSwitched = () => {
    showNetworkPrompt = false;
    toastStore.success('Network switched successfully! You can now see the current pot.');
  };

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
      
      // Show specific error message to user with iOS guidance
      let errorMessage = error.message || 'Failed to connect wallet. Please try again.';
      
      if (isIOS && !hasMetaMask && !hasPhantom) {
        if (walletType === 'injected') {
          errorMessage = 'No wallet app detected. Please install MetaMask or Phantom, then open this page from within the wallet app\'s browser.';
        } else if (walletType === 'walletconnect') {
          errorMessage = 'WalletConnect failed. Make sure you have a compatible wallet app installed (MetaMask, Phantom, etc.) and try again.';
        }
      }
      
      toastStore.error(errorMessage);
    } finally {
      connecting = false;
      console.log('🔗 WalletConnect handleConnect finished');
    }
  };

  const handleInjectedConnect = () => handleConnect('injected');
  const handleWalletConnect = () => handleConnect('walletconnect');
  
  // Add deep linking for mobile wallets (iOS and Android)
  const handleMobileWalletDeepLink = (walletName) => {
    // Check if we're on mobile (iOS or Android)
    const isMobileDevice = isMobile();
    
    if (!isMobileDevice) {
      // On desktop, fall back to regular wallet connection
      handleWalletConnect();
      return;
    }
    
    // Get the current URL and encode it properly for deep linking
    const currentUrl = window.location.href;
    const encodedUrl = encodeURIComponent(currentUrl);
    
    let deepLinkUrl = '';
    
    switch (walletName) {
      case 'metamask':
        // MetaMask deep link format with proper URL encoding
        deepLinkUrl = `https://metamask.app.link/dapp/${encodedUrl}`;
        break;
      case 'phantom':
        // Phantom deep link format - using full URL encoding like MetaMask
        deepLinkUrl = `https://phantom.app/ul/browse/${encodedUrl}`;
        break;
      default:
        handleWalletConnect();
        return;
    }
    
    console.log('📱 Navigating to mobile wallet deep link:', {
      walletName,
      originalUrl: currentUrl,
      encodedUrl,
      deepLinkUrl,
      isMobileDevice,
      isIOS,
      userAgent: navigator.userAgent
    });
    
    // Navigate directly to the deep link (better than window.open)
    window.location.href = deepLinkUrl;
  };
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
      {#if isIOS && !hasMetaMask && !hasPhantom}
        <div class="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p class="text-blue-300 text-sm font-medium mb-2">📱 iOS Users:</p>
          <p class="text-blue-200 text-xs">
            For best results, open this page from within your wallet app's browser (MetaMask, Phantom, etc.)
            or use the "Mobile Wallet" option below to connect via WalletConnect.
          </p>
        </div>
      {/if}
      <p class="text-gray-400 text-center max-w-md">
        Connect your Ethereum wallet to start playing ETH Shot on {NETWORK_CONFIG.NETWORK_NAME}.
        We support MetaMask, WalletConnect, and other popular wallets.
      </p>
      <div class="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3 mt-3">
        <p class="text-yellow-300 text-sm font-medium mb-1">
          {NETWORK_CONFIG.CHAIN_ID === 1 ? '🌐 Mainnet Notice' : '🧪 Testnet Notice'}
        </p>
        <p class="text-yellow-200 text-xs">
          {#if NETWORK_CONFIG.CHAIN_ID === 1}
            ETH Shot runs on {NETWORK_CONFIG.NETWORK_NAME}. You'll need real ETH to play.
            After connecting, we'll help you switch to the correct network if needed.
          {:else}
            ETH Shot runs on {NETWORK_CONFIG.NETWORK_NAME}. You'll need testnet ETH to play (free from faucets).
            After connecting, we'll help you switch to the correct network if needed.
          {/if}
        </p>
      </div>
    </div>

    <!-- Connect Buttons -->
    <div class="connect-buttons space-y-3">
      <!-- Auto Connect (tries injected first, then WalletConnect) -->
      <button
        on:click={() => handleConnect()}
        disabled={connecting}
        class="connect-button connect-button-primary"
        style="pointer-events: auto; cursor: pointer;"
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
        
        {#if showMobileWallet}
          <!-- Mobile-specific options with deep linking (iOS and Android) -->
          <div class="grid grid-cols-1 gap-2 mb-3">
            <button
              on:click={() => handleMobileWalletDeepLink('metamask')}
              disabled={connecting}
              class="connect-button connect-button-secondary flex items-center justify-center space-x-2"
            >
              <img src="/icons/metamask.svg" alt="MetaMask" class="w-4 h-4" />
              <span class="text-sm">Open in MetaMask</span>
            </button>
            <button
              on:click={() => handleMobileWalletDeepLink('phantom')}
              disabled={connecting}
              class="connect-button connect-button-secondary flex items-center justify-center space-x-2"
            >
              <img src="/icons/phantom.svg" alt="Phantom" class="w-4 h-4" />
              <span class="text-sm">Open in Phantom</span>
            </button>
          </div>
          <div class="text-xs text-gray-500 mb-2">Or use WalletConnect:</div>
        {/if}
        
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
              <span class="text-sm">WalletConnect</span>
            </button>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Network Switch Prompt Modal -->
    <NetworkSwitchPrompt
      bind:show={showNetworkPrompt}
      onNetworkSwitched={handleNetworkSwitched}
    />

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