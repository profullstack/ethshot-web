<script>
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/stores/wallet.js';
  import { gameStore } from '$lib/stores/game/index.js';
  import { NETWORK_CONFIG } from '$lib/config.js';
  import { browser } from '$app/environment';

  let isOwner = false;
  let testModeConfig = {
    isTestMode: false,
    isFiftyPercentMode: false,
    currentChainId: 0
  };
  let houseFunds = 0;
  let loading = false;
  let error = null;
  let success = null;

  // Check if current user is contract owner
  const checkOwnership = async () => {
    if (!browser || !$walletStore.connected || !$gameStore.contract) return;
    
    try {
      const ethers = await import('ethers');
      const contract = $gameStore.contract;
      const ownerAddress = await contract.owner();
      isOwner = ownerAddress.toLowerCase() === $walletStore.address.toLowerCase();
    } catch (err) {
      console.error('Failed to check ownership:', err);
      isOwner = false;
    }
  };

  // Load current test mode configuration
  const loadTestModeConfig = async () => {
    if (!browser || !$gameStore.contract) return;
    
    try {
      const contract = $gameStore.contract;
      const config = await contract.getTestModeConfig();
      testModeConfig = {
        isTestMode: config.isTestMode,
        isFiftyPercentMode: config.isFiftyPercentMode,
        currentChainId: Number(config.currentChainId)
      };
    } catch (err) {
      console.error('Failed to load test mode config:', err);
    }
  };

  // Load house funds balance
  const loadHouseFunds = async () => {
    if (!browser || !$gameStore.contract) return;
    
    try {
      const contract = $gameStore.contract;
      const funds = await contract.getHouseFunds();
      houseFunds = Number(funds);
    } catch (err) {
      console.error('Failed to load house funds:', err);
    }
  };

  // Enable/disable test mode
  const toggleTestMode = async () => {
    if (!$walletStore.signer || !$gameStore.contract) return;
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const contract = $gameStore.contract.connect($walletStore.signer);
      const tx = await contract.setTestMode(!testModeConfig.isTestMode);
      await tx.wait();
      
      success = `Test mode ${!testModeConfig.isTestMode ? 'enabled' : 'disabled'} successfully!`;
      await loadTestModeConfig();
    } catch (err) {
      console.error('Failed to toggle test mode:', err);
      error = err.reason || err.message || 'Failed to toggle test mode';
    } finally {
      loading = false;
    }
  };

  // Enable/disable 50% win rate mode
  const toggleFiftyPercentMode = async () => {
    if (!$walletStore.signer || !$gameStore.contract) return;
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const contract = $gameStore.contract.connect($walletStore.signer);
      const tx = await contract.setTestFiftyPercentMode(!testModeConfig.isFiftyPercentMode);
      await tx.wait();
      
      success = `50% win rate mode ${!testModeConfig.isFiftyPercentMode ? 'enabled' : 'disabled'} successfully!`;
      await loadTestModeConfig();
    } catch (err) {
      console.error('Failed to toggle 50% mode:', err);
      error = err.reason || err.message || 'Failed to toggle 50% win rate mode';
    } finally {
      loading = false;
    }
  };

  // Set specific winning number (for traditional test mode)
  const setWinningNumber = async (winningNumber) => {
    if (!$walletStore.signer || !$gameStore.contract) return;
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const contract = $gameStore.contract.connect($walletStore.signer);
      const tx = await contract.setWinningNumber(winningNumber);
      await tx.wait();
      
      success = `Winning number set to ${winningNumber} successfully!`;
    } catch (err) {
      console.error('Failed to set winning number:', err);
      error = err.reason || err.message || 'Failed to set winning number';
    } finally {
      loading = false;
    }
  };

  // Withdraw house funds to house address
  const withdrawHouseFunds = async () => {
    if (!$walletStore.signer || !$gameStore.contract) return;
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const contract = $gameStore.contract.connect($walletStore.signer);
      const tx = await contract.withdrawHouseFunds();
      await tx.wait();
      
      const ethers = await import('ethers');
      const withdrawnAmount = ethers.formatEther(houseFunds);
      success = `Successfully withdrew ${withdrawnAmount} ETH to house address!`;
      
      // Reload house funds balance
      await loadHouseFunds();
    } catch (err) {
      console.error('Failed to withdraw house funds:', err);
      error = err.reason || err.message || 'Failed to withdraw house funds';
    } finally {
      loading = false;
    }
  };

  onMount(async () => {
    await checkOwnership();
    if (isOwner) {
      await loadTestModeConfig();
      await loadHouseFunds();
    }
  });

  // Reactive updates when wallet or contract changes
  $: if ($walletStore.connected && $gameStore.contract) {
    checkOwnership();
  }

  $: if (isOwner && $gameStore.contract) {
    loadTestModeConfig();
    loadHouseFunds();
  }

  // Clear messages after 5 seconds
  $: if (success || error) {
    setTimeout(() => {
      success = null;
      error = null;
    }, 5000);
  }
</script>

{#if isOwner}
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/50">
    <h3 class="text-lg font-bold mb-4 text-yellow-400 flex items-center space-x-2">
      <span>⚙️</span>
      <span>Admin Panel</span>
      <span class="text-xs bg-yellow-500/20 px-2 py-1 rounded">OWNER ONLY</span>
    </h3>

    <!-- Network Info -->
    <div class="mb-4 p-3 bg-gray-700/50 rounded-lg">
      <div class="text-sm space-y-1">
        <div class="flex justify-between">
          <span class="text-gray-400">Chain ID:</span>
          <span class="font-mono">{testModeConfig.currentChainId}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Network:</span>
          <span class="font-mono">
            {testModeConfig.currentChainId === 1 ? 'Mainnet' : 'Testnet'}
          </span>
        </div>
      </div>
    </div>

    <!-- House Funds Management -->
    <div class="mb-4 p-3 bg-gray-700/50 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">House Funds</div>
          <div class="text-xs text-gray-400">
            {#await import('ethers') then ethers}
              Available: {ethers.formatEther(houseFunds)} ETH
            {/await}
          </div>
        </div>
        <button
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || houseFunds === 0}
          on:click={withdrawHouseFunds}
        >
          Withdraw to House
        </button>
      </div>
    </div>

    <!-- Test Mode Controls -->
    <div class="space-y-4">
      <!-- Test Mode Toggle -->
      <div class="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
        <div>
          <div class="font-medium">Test Mode</div>
          <div class="text-xs text-gray-400">
            {testModeConfig.currentChainId === 1
              ? 'Disabled on mainnet'
              : testModeConfig.isTestMode
                ? 'Enabled: 1min cooldown + test features'
                : 'Disabled: Normal 1hr cooldown from .env'}
          </div>
        </div>
        <button
          class="px-4 py-2 rounded-lg font-medium transition-colors {testModeConfig.isTestMode
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-600 hover:bg-gray-700 text-white'} disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || testModeConfig.currentChainId === 1}
          on:click={toggleTestMode}
        >
          {testModeConfig.isTestMode ? 'ON' : 'OFF'}
        </button>
      </div>

      <!-- 50% Win Rate Mode Toggle -->
      {#if testModeConfig.isTestMode}
        <div class="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
          <div>
            <div class="font-medium">50% Win Rate Mode</div>
            <div class="text-xs text-gray-400">Alternating wins for testing payouts</div>
          </div>
          <button
            class="px-4 py-2 rounded-lg font-medium transition-colors {testModeConfig.isFiftyPercentMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-600 hover:bg-gray-700 text-white'} disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
            on:click={toggleFiftyPercentMode}
          >
            {testModeConfig.isFiftyPercentMode ? 'ON' : 'OFF'}
          </button>
        </div>

        <!-- Traditional Test Mode Controls -->
        {#if !testModeConfig.isFiftyPercentMode}
          <div class="p-3 bg-gray-700/50 rounded-lg">
            <div class="font-medium mb-2">Manual Win Control</div>
            <div class="text-xs text-gray-400 mb-3">Set winning number (1 = win, 0 = lose)</div>
            <div class="flex space-x-2">
              <button
                class="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
                on:click={() => setWinningNumber(0)}
              >
                Force Lose (0)
              </button>
              <button
                class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
                on:click={() => setWinningNumber(1)}
              >
                Force Win (1)
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Status Messages -->
    {#if loading}
      <div class="mt-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
        <div class="flex items-center space-x-2">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <span class="text-blue-400">Processing transaction...</span>
        </div>
      </div>
    {/if}

    {#if success}
      <div class="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
        <span class="text-green-400">✅ {success}</span>
      </div>
    {/if}

    {#if error}
      <div class="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
        <span class="text-red-400">❌ {error}</span>
      </div>
    {/if}

    <!-- Usage Instructions -->
    <div class="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <div class="text-xs text-yellow-400">
        <div class="font-medium mb-1">Usage Instructions:</div>
        <ul class="space-y-1 list-disc list-inside">
          <li>House funds are accumulated from game fees and sponsorships</li>
          <li>Withdraw sends all house funds to the house commission address</li>
          <li>Test mode is automatically disabled on mainnet</li>
          <li>When test mode is ON: cooldown is 1 minute (for rapid testing)</li>
          <li>When test mode is OFF: cooldown is normal 1 hour from .env</li>
          <li>50% mode alternates wins/losses for testing payouts</li>
          <li>Manual mode lets you force specific outcomes</li>
          <li>Changes take effect immediately for new shots</li>
        </ul>
      </div>
    </div>
  </div>
{/if}