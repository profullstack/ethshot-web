<script>
  import { onMount, onDestroy } from 'svelte';
  import { isCorrectNetwork, switchToNetwork, getNetworkStatus, onNetworkChange, getTestnetInfo } from '../utils/network-detection.js';
  import { NETWORK_CONFIG } from '../config.js';
  import { toastStore } from '../stores/toast.js';

  // Component props
  export let show = false;
  export let onNetworkSwitched = () => {};

  // Component state
  let networkStatus = null;
  let isLoading = false;
  let isSwitching = false;
  let showTestnetInfo = false;
  let testnetInfo = getTestnetInfo();
  let networkChangeCleanup = null;

  // Check network status on mount
  onMount(async () => {
    await checkNetworkStatus();
    
    // Listen for network changes
    networkChangeCleanup = onNetworkChange(async (chainId) => {
      await checkNetworkStatus();
      if (await isCorrectNetwork()) {
        show = false;
        onNetworkSwitched();
        toastStore.success(`Successfully switched to ${NETWORK_CONFIG.NETWORK_NAME}!`);
      }
    });
  });

  // Cleanup network listener
  onDestroy(() => {
    if (networkChangeCleanup) {
      networkChangeCleanup();
    }
  });

  // Check current network status
  const checkNetworkStatus = async () => {
    isLoading = true;
    try {
      networkStatus = await getNetworkStatus();
      show = !networkStatus.isCorrectNetwork && networkStatus.hasWallet;
    } catch (error) {
      console.error('Failed to check network status:', error);
      toastStore.error('Failed to check network status');
    } finally {
      isLoading = false;
    }
  };

  // Handle network switch
  const handleSwitchNetwork = async () => {
    isSwitching = true;
    try {
      await switchToNetwork();
      toastStore.info('Network switch initiated. Please approve in your wallet.');
      
      // Check if switch was successful after a short delay
      setTimeout(async () => {
        await checkNetworkStatus();
        if (networkStatus?.isCorrectNetwork) {
          show = false;
          onNetworkSwitched();
          toastStore.success(`Successfully switched to ${NETWORK_CONFIG.NETWORK_NAME}!`);
        }
      }, 2000);
    } catch (error) {
      console.error('Network switch failed:', error);
      toastStore.error(`Failed to switch network: ${error.message}`);
    } finally {
      isSwitching = false;
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    await checkNetworkStatus();
  };

  // Toggle testnet info display
  const toggleTestnetInfo = () => {
    showTestnetInfo = !showTestnetInfo;
  };
</script>

{#if show && networkStatus}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <!-- Header -->
      <div class="flex items-center mb-4">
        <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
          <svg class="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900">Wrong Network Detected</h3>
      </div>

      <!-- Current vs Expected Network -->
      <div class="mb-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p class="text-sm text-red-800">
            <span class="font-medium">Current Network:</span> {networkStatus.currentNetworkName}
          </p>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-3">
          <p class="text-sm text-green-800">
            <span class="font-medium">Required Network:</span> {networkStatus.expectedNetworkName}
          </p>
        </div>
      </div>

      <!-- Explanation -->
      <div class="mb-6">
        <p class="text-sm text-gray-600 mb-3">
          ETH Shot runs on {NETWORK_CONFIG.NETWORK_NAME}. You need to switch your wallet to the correct network to see the current pot and play the game.
        </p>
        {#if NETWORK_CONFIG.CHAIN_ID !== 1}
          <p class="text-xs text-gray-500">
            Don't worry - this is a testnet, so you won't spend real ETH!
          </p>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3">
        <!-- Switch Network Button -->
        <button
          on:click={handleSwitchNetwork}
          disabled={isSwitching}
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
        >
          {#if isSwitching}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Switching Network...
          {:else}
            Switch to {NETWORK_CONFIG.NETWORK_NAME}
          {/if}
        </button>

        <!-- Get Testnet ETH Button (only show for testnets) -->
        {#if NETWORK_CONFIG.CHAIN_ID !== 1}
          <button
            on:click={toggleTestnetInfo}
            class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {showTestnetInfo ? 'Hide' : 'Show'} Testnet ETH Instructions
          </button>
        {/if}

        <!-- Refresh Button -->
        <button
          on:click={handleRefresh}
          disabled={isLoading}
          class="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {isLoading ? 'Checking...' : 'Refresh Network Status'}
        </button>
      </div>

      <!-- Testnet Info (Collapsible) -->
      {#if showTestnetInfo}
        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 class="font-medium text-blue-900 mb-2">Getting Testnet ETH</h4>
          <ol class="text-sm text-blue-800 space-y-1 mb-3">
            {#each testnetInfo.instructions as instruction, index}
              <li>{index + 1}. {instruction}</li>
            {/each}
          </ol>
          
          <div class="space-y-2">
            <p class="text-xs font-medium text-blue-900">Recommended Faucets:</p>
            {#if testnetInfo.faucetUrl}
              <a
                href={testnetInfo.faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="block text-xs text-blue-600 hover:text-blue-800 underline"
              >
                🚰 {NETWORK_CONFIG.NETWORK_NAME} Faucet (Primary)
              </a>
            {/if}
            {#each testnetInfo.alternativeFaucets as faucet}
              <a 
                href={faucet} 
                target="_blank" 
                rel="noopener noreferrer"
                class="block text-xs text-blue-600 hover:text-blue-800 underline"
              >
                🚰 Alternative Faucet
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Manual Instructions -->
      <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p class="text-xs text-gray-600">
          <span class="font-medium">Manual Setup:</span> If the automatic switch doesn't work,
          manually add {NETWORK_CONFIG.NETWORK_NAME} in your wallet settings with Chain ID: {NETWORK_CONFIG.CHAIN_ID}
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Ensure the modal appears above other content */
  :global(.modal-backdrop) {
    backdrop-filter: blur(2px);
  }
</style>