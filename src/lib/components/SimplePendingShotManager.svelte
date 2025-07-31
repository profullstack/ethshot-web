<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { walletStore } from '../stores/wallet.js';
  import { gameStore } from '../stores/game/core.js';
  import { toastStore } from '../stores/toast.js';
  import { debugMode } from '../stores/debug.js';
  import { GameActions } from '../stores/game/index.js';

  let pendingShot = null;
  let loading = false;
  let checkingStatus = false;

  $: wallet = $walletStore;
  $: state = $gameStore;

  const checkPendingShot = async () => {
    if (!wallet.connected || checkingStatus) return;

    checkingStatus = true;
    try {
      console.log('🔍 SimplePendingShotManager: Checking for pending shots...');
      
      // Check if we're in multi-crypto mode and have a pending shot in state
      if (state.isMultiCryptoMode && state.pendingShot) {
        console.log('✅ Multi-crypto mode: Found pending shot in game state');
        
        pendingShot = {
          exists: true,
          blockNumber: 0, // Not applicable in multi-crypto mode
          amount: state.pendingShot.actualShotCost,
          currentBlock: 0, // Not applicable in multi-crypto mode
          canReveal: true, // Always ready to reveal in multi-crypto mode
          revealExpired: false, // Doesn't expire in multi-crypto mode
          blocksToWait: 0, // No waiting in multi-crypto mode
          isMultiCrypto: true,
          hasSecret: !!state.pendingShot.secret
        };
        
        console.log('✅ Multi-crypto pending shot detected:', pendingShot);
        
        // Auto-reveal for multi-crypto mode
        if (pendingShot.canReveal && pendingShot.hasSecret && !loading) {
          console.log('🎯 Auto-revealing multi-crypto shot...');
          await handleRevealShot();
        }
        return;
      }
      
      // ETH-only mode: check contract state
      if (!state.contractDeployed) {
        pendingShot = null;
        return;
      }
      
      // Wait for gameStore to be fully initialized
      let contract = state.contract;
      let provider = wallet.provider;
      let ethers = state.ethers;
      
      // If gameStore isn't ready, don't proceed yet
      if (!contract || !ethers) {
        console.log('⏳ GameStore not fully initialized yet, waiting...');
        console.log('Contract:', !!contract, 'Ethers:', !!ethers);
        pendingShot = null;
        return;
      }
      
      console.log('✅ Using contract and ethers from gameStore');

      // Use the same logic as player-operations.js
      const canCommit = await contract.canCommitShot(wallet.address);
      const hasPending = await contract.hasPendingShot(wallet.address);
      
      console.log('🔍 Shot validation checks:', {
        canCommit,
        hasPending,
        walletAddress: wallet.address
      });
      
      // If canCommitShot is false but there's no explicit pending shot,
      // it might be a cooldown or other issue
      if (!canCommit && !hasPending) {
        console.log('❌ Cannot commit shot but no pending shot detected - likely cooldown');
        pendingShot = null;
        return;
      }
      
      // If there's a pending shot OR canCommitShot is false, investigate further
      if (hasPending || !canCommit) {
        const shotInfo = await contract.getPendingShot(wallet.address);
        const currentBlock = await provider.getBlockNumber();
        const commitBlock = Number(shotInfo.blockNumber);
        const revealDelay = 1; // REVEAL_DELAY from contract
        const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
        
        const canReveal = currentBlock > commitBlock + revealDelay;
        const revealExpired = currentBlock > commitBlock + maxRevealDelay;
        const blocksToWait = Math.max(0, (commitBlock + revealDelay) - currentBlock);
        
        console.log('🔍 Pending shot details:', {
          commitBlock,
          currentBlock,
          canReveal,
          revealExpired,
          blocksToWait
        });
        
        pendingShot = {
          exists: true,
          blockNumber: commitBlock,
          amount: ethers.formatEther(shotInfo.amount),
          currentBlock,
          canReveal,
          revealExpired,
          blocksToWait,
          isMultiCrypto: false,
          hasSecret: !!(state.pendingShot && state.pendingShot.secret) // Check if we have a stored secret
        };
        
        console.log('✅ ETH-only pending shot detected and will be displayed');
        console.log('🎯 PENDING SHOT OBJECT CREATED:', pendingShot);
        console.log('🎯 UI SHOULD NOW RENDER WITH:', {
          exists: pendingShot.exists,
          revealExpired: pendingShot.revealExpired,
          canReveal: pendingShot.canReveal
        });
        
        // Auto-reveal for ETH-only mode when ready
        if (pendingShot.canReveal && pendingShot.hasSecret && !loading) {
          console.log('🎯 Auto-revealing ETH-only shot...');
          // Add a small delay to ensure the reveal window is fully open
          setTimeout(async () => {
            if (pendingShot && pendingShot.canReveal && !loading) {
              await handleRevealShot();
            }
          }, 2000);
        }
      } else {
        console.log('✅ No pending shot found');
        pendingShot = null;
      }
    } catch (error) {
      console.error('❌ Failed to check pending shot:', error);
      pendingShot = null;
    } finally {
      checkingStatus = false;
    }
  };

  const handleRefreshPage = () => {
    toastStore.info('Refreshing page to clear pending shot state...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleWaitForBlocks = () => {
    const timeEstimate = getTimeEstimate(pendingShot.blocksToWait);
    toastStore.info(`Please wait ${pendingShot.blocksToWait} more block(s) (${timeEstimate}) for the reveal window to open.`);
  };

  const getTimeEstimate = (blocks) => {
    if (!blocks || blocks <= 0) return '0 seconds';
    
    // Estimate based on common networks
    // Most testnets are faster than mainnet
    const secondsPerBlock = 3; // Conservative estimate for testnets
    const totalSeconds = blocks * secondsPerBlock;
    
    if (totalSeconds < 60) {
      return `~${totalSeconds} seconds`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.ceil(totalSeconds / 60);
      return `~${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      const hours = Math.ceil(totalSeconds / 3600);
      return `~${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  const handleCleanupExpired = async () => {
    loading = true;
    try {
      console.log('🧹 Starting cleanup of expired pending shot...');
      
      // Use the service function instead of utility
      const currentGameState = gameStore.getGameState();
      const currentWalletStore = gameStore.getWalletStore();
      const currentWallet = get(currentWalletStore);
      
      await GameActions.cleanupExpiredPendingShot({
        playerAddress: currentWallet.address,
        gameState: currentGameState,
        wallet: currentWallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers()
      });
      
      console.log('✅ Cleanup successful!');
      toastStore.success('Expired pending shot cleaned up successfully');
      await checkPendingShot();
    } catch (error) {
      console.error('❌ Failed to cleanup expired shot:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        reason: error.reason
      });
      
      // Show the actual error to the user - no fallbacks that hide issues
      toastStore.error('Failed to cleanup expired shot: ' + error.message);
    } finally {
      loading = false;
    }
  };

  const handleRevealShot = async () => {
    if (loading) {
      console.log('⏳ Reveal already in progress, skipping...');
      return;
    }
    
    loading = true;
    try {
      let secret = null;
      
      // Check if we have a stored secret (works for both multi-crypto and ETH-only modes)
      if (pendingShot.hasSecret && state.pendingShot && state.pendingShot.secret) {
        console.log('🎯 Using stored secret from game state...');
        secret = state.pendingShot.secret;
      } else {
        // Try to get secret from localStorage as fallback
        try {
          const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
          const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
          
          if (existingSecrets.length > 0) {
            // Get the most recent secret
            const latestSecretKey = existingSecrets[existingSecrets.length - 1];
            const secretDataStr = localStorage.getItem(latestSecretKey);
            if (secretDataStr) {
              const secretData = JSON.parse(secretDataStr);
              secret = secretData.secret;
              console.log('🎯 Using secret from localStorage fallback...');
            }
          }
        } catch (localStorageError) {
          console.warn('Failed to get secret from localStorage:', localStorageError);
        }
        
        if (!secret) {
          console.error('❌ No stored secret available for reveal');
          toastStore.error('No secret available for reveal. The shot may have been taken in a previous session. Please clear the pending shot and take a new one.');
          return;
        }
      }

      console.log('🎯 Revealing pending shot with stored secret...');
      toastStore.info('Revealing pending shot...');
      
      // Call the reveal function from the service
      const currentGameState = gameStore.getGameState();
      const currentWalletStore = gameStore.getWalletStore();
      const currentWallet = get(currentWalletStore);
      
      const result = await GameActions.revealShot({
        secret,
        gameState: currentGameState,
        wallet: currentWallet,
        contract: gameStore.getContract(),
        ethers: gameStore.getEthers(),
        loadGameState: gameStore.loadGameState,
        loadPlayerData: gameStore.loadPlayerData
      });
      
      console.log('✅ Pending shot revealed successfully!', result);
      
      // Show appropriate message based on win/loss
      if (result.won) {
        toastStore.success('🎉 JACKPOT! YOU WON! 🎊');
        console.log('🎉 Shot revealed - YOU WON THE JACKPOT!');
      } else {
        toastStore.info('🎲 Shot revealed - No win this time. Better luck next shot!');
        console.log('🎲 Shot revealed - No win this time');
      }
      
      // Clean up localStorage
      try {
        const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
        const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
        
        // Remove the revealed secret
        const updatedSecrets = existingSecrets.filter(key => {
          const secretDataStr = localStorage.getItem(key);
          if (secretDataStr) {
            const secretData = JSON.parse(secretDataStr);
            return secretData.txHash !== result.receipt.hash;
          }
          return true;
        });
        
        localStorage.setItem(savedSecretsKey, JSON.stringify(updatedSecrets));
        
        // Also remove the individual secret entry
        const secretKey = `ethshot_secret_${wallet.address}_${result.receipt.hash.slice(0, 10)}`;
        localStorage.removeItem(secretKey);
      } catch (cleanupError) {
        console.warn('Failed to cleanup localStorage:', cleanupError);
      }
      
      await checkPendingShot();
    } catch (error) {
      console.error('❌ Failed to reveal pending shot:', error);
      toastStore.error('Failed to reveal pending shot: ' + error.message);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    // Only run automated checking if debug mode is disabled
    if (!$debugMode) {
      // Initial check with a small delay to ensure everything is loaded
      setTimeout(() => {
        checkPendingShot();
      }, 1000);
      
      // Check every 5 seconds for better responsiveness
      const interval = setInterval(checkPendingShot, 5000);
      return () => clearInterval(interval);
    } else {
      console.log('🔧 Debug mode enabled - automated pending shot checking disabled');
    }
  });

  // Re-check when wallet connects or contract changes (only if debug mode is disabled)
  $: if (!$debugMode && wallet.connected && (state.contract || wallet.contract)) {
    checkPendingShot();
  }
  
  // Also check when gameStore contract becomes available (only if debug mode is disabled)
  $: if (!$debugMode && wallet.connected && state.contract && state.ethers) {
    console.log('🔄 GameStore contract became available, checking for pending shots...');
    checkPendingShot();
  }
</script>

<!-- Debug Info - only show when debug mode is enabled -->
{#if $debugMode}
<div class="debug-info" style="background: #333; color: white; padding: 15px; margin: 10px 0; border-radius: 8px; font-size: 14px; border: 2px solid #e94560;">
  <h4 style="color: #e94560; margin: 0 0 10px 0;">🔍 SimplePendingShotManager Debug</h4>
  <p>- Wallet connected: <span style="color: {wallet.connected ? '#2ed573' : '#e94560'}">{wallet.connected}</span></p>
  <p>- Wallet address: <span style="color: #ffa500">{wallet.address || 'None'}</span></p>
  <p>- Contract deployed: <span style="color: {state.contractDeployed ? '#2ed573' : '#e94560'}">{state.contractDeployed}</span></p>
  <p>- Has contract (wallet): <span style="color: {wallet.contract ? '#2ed573' : '#e94560'}">{!!wallet.contract}</span></p>
  <p>- Has contract (gameStore): <span style="color: {state.contract ? '#2ed573' : '#e94560'}">{!!state.contract}</span></p>
  <p>- Has ethers (gameStore): <span style="color: {state.ethers ? '#2ed573' : '#e94560'}">{!!state.ethers}</span></p>
  <p>- Pending shot exists: <span style="color: {pendingShot ? '#2ed573' : '#e94560'}">{!!pendingShot}</span></p>
  <p>- Checking status: <span style="color: {checkingStatus ? '#ffa500' : '#2ed573'}">{checkingStatus}</span></p>
  <p>- Loading: <span style="color: {loading ? '#ffa500' : '#2ed573'}">{loading}</span></p>
  {#if pendingShot}
    <p>- Pending shot details: <span style="color: #2ed573">{JSON.stringify(pendingShot)}</span></p>
  {:else}
    <p>- No pending shot detected</p>
  {/if}
  
  <!-- Manual Check Button -->
  <button
    style="background: #e94560; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 10px; cursor: pointer;"
    on:click={checkPendingShot}
    disabled={checkingStatus}
  >
    {checkingStatus ? 'Checking...' : 'Manual Check for Pending Shot'}
  </button>
  
  <!-- Force Test Button -->
  <button
    style="background: #ffa500; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 10px; cursor: pointer;"
    on:click={() => {
      console.log('🧪 FORCE TESTING: Setting pendingShot manually');
      pendingShot = {
        exists: true,
        blockNumber: 8860511,
        amount: '0.001',
        currentBlock: 8860822,
        canReveal: true,
        revealExpired: true,
        blocksToWait: 0
      };
      console.log('🧪 FORCE TEST: pendingShot set to:', pendingShot);
    }}
  >
    🧪 Force Test UI
  </button>
</div>
{/if}

{#if pendingShot}
  <div class="pending-shot-manager">
    <div class="pending-shot-info">
      <h3>⏳ Pending Shot Detected</h3>
      <p>You have a pending shot of <strong>{pendingShot.amount} ETH</strong></p>
      {#if pendingShot.revealExpired}
        <p>Wait <strong>0 blocks</strong> to clear (expired - can clear now)</p>
      {:else}
        <p>Wait <strong>{Math.max(0, (pendingShot.blockNumber + 256) - pendingShot.currentBlock)} blocks</strong> to clear (about <strong>{getTimeEstimate(Math.max(0, (pendingShot.blockNumber + 256) - pendingShot.currentBlock))}</strong>)</p>
      {/if}
      
      <!-- Multi-crypto mode: Show reveal button -->
      {#if pendingShot.isMultiCrypto}
        <div class="status ready">
          <p>🎲 <strong>Ready to reveal shot result!</strong></p>
          <p>Your shot has been committed and is ready to be revealed.</p>
          <div class="button-group">
            <button
              class="action-btn reveal-btn"
              on:click={handleRevealShot}
              disabled={loading}
            >
              {loading ? 'Revealing...' : '🎲 Reveal Shot Result'}
            </button>
          </div>
        </div>
      {:else if pendingShot.revealExpired}
        <!-- ETH-only mode: Expired shots -->
        <div class="status expired">
          <p>❌ <strong>Reveal window expired</strong></p>
          <p>This shot has expired and needs to be cleared to allow new shots.</p>
          <div class="button-group">
            <button
              class="action-btn cleanup-btn"
              on:click={handleCleanupExpired}
              disabled={loading}
            >
              {loading ? 'Cleaning up...' : 'Clean Up Expired Shot'}
            </button>
            <button
              class="action-btn refresh-btn secondary"
              on:click={handleRefreshPage}
              disabled={loading}
            >
              Or Refresh Page
            </button>
          </div>
        </div>
      {:else}
        <!-- ETH-only mode: Waiting or ready to reveal -->
        {#if pendingShot.canReveal && pendingShot.hasSecret}
          <!-- Ready to reveal with stored secret -->
          <div class="status ready">
            <p>🎲 <strong>Ready to reveal shot result!</strong></p>
            <p>Your shot is ready to be revealed using your stored secret.</p>
            <div class="button-group">
              <button
                class="action-btn reveal-btn"
                on:click={handleRevealShot}
                disabled={loading}
              >
                {loading ? 'Revealing...' : '🎲 Reveal Shot Result'}
              </button>
              <button
                class="action-btn cleanup-btn secondary"
                on:click={handleCleanupExpired}
                disabled={loading}
              >
                {loading ? 'Clearing...' : 'Or Clear Pending Shot'}
              </button>
            </div>
          </div>
        {:else if pendingShot.canReveal && !pendingShot.hasSecret}
          <!-- Ready to reveal but need manual secret entry -->
          <div class="status ready">
            <p>🔑 <strong>Ready to reveal - Secret required</strong></p>
            <p>Your shot can be revealed, but you need to enter your secret manually.</p>
            <div class="button-group">
              <button
                class="action-btn reveal-btn"
                on:click={handleRevealShot}
                disabled={loading}
              >
                {loading ? 'Revealing...' : '🎲 Reveal Shot (Enter Secret)'}
              </button>
              <button
                class="action-btn cleanup-btn secondary"
                on:click={handleCleanupExpired}
                disabled={loading}
              >
                {loading ? 'Clearing...' : 'Or Clear Pending Shot'}
              </button>
            </div>
          </div>
        {:else}
          <!-- Still waiting for reveal window -->
          <div class="status waiting">
            <p>⏳ <strong>Waiting for reveal window</strong></p>
            <p>Please wait {pendingShot.blocksToWait} more block(s) before you can reveal this shot.</p>
            <p class="time-estimate">⏰ <strong>Estimated time:</strong> {getTimeEstimate(pendingShot.blocksToWait)}</p>
            <div class="button-group">
              <button
                class="action-btn wait-btn"
                on:click={handleWaitForBlocks}
                disabled={loading}
              >
                ⏳ Wait for Reveal Window
              </button>
              <button
                class="action-btn cleanup-btn secondary"
                on:click={handleCleanupExpired}
                disabled={loading}
              >
                {loading ? 'Clearing...' : 'Or Clear Pending Shot'}
              </button>
            </div>
          </div>
        {/if}
      {/if}
      
      <div class="help-text">
        <p><strong>What happened?</strong> You started a shot but didn't complete the reveal step. This is part of the commit-reveal process that ensures fair randomness.</p>
        {#if pendingShot.canReveal}
          <p><strong>Good news:</strong> Your shot is ready to reveal! Click the reveal button above to see if you won.</p>
        {:else}
          <p><strong>Please wait:</strong> The reveal window opens after {pendingShot.blocksToWait} more block(s). This prevents manipulation of the random outcome.</p>
        {/if}
        <p><strong>Alternative:</strong> You can clear the pending shot and start over, but you'll lose the ETH you already spent.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .pending-shot-manager {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #e94560;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: 0 8px 32px rgba(233, 69, 96, 0.3);
  }

  .pending-shot-info h3 {
    color: #e94560;
    margin: 0 0 15px 0;
    font-size: 1.2em;
    font-weight: bold;
  }

  .pending-shot-info p {
    color: #ffffff;
    margin: 8px 0;
    font-size: 0.95em;
  }

  .status {
    margin-top: 15px;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid;
  }

  .status.expired {
    background: rgba(233, 69, 96, 0.1);
    border-left-color: #e94560;
  }

  .status.ready {
    background: rgba(46, 213, 115, 0.1);
    border-left-color: #2ed573;
  }

  .status.waiting {
    background: rgba(255, 165, 0, 0.1);
    border-left-color: #ffa500;
  }

  .action-btn {
    background: linear-gradient(135deg, #e94560 0%, #0f3460 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 10px;
    width: 100%;
  }

  .cleanup-btn {
    background: linear-gradient(135deg, #2ed573 0%, #0f3460 100%);
  }

  .reveal-btn {
    background: linear-gradient(135deg, #2ed573 0%, #0f3460 100%);
  }

  .refresh-btn {
    background: linear-gradient(135deg, #2ed573 0%, #0f3460 100%);
  }

  .refresh-btn.secondary {
    background: linear-gradient(135deg, #6c757d 0%, #0f3460 100%);
    margin-top: 8px;
  }

  .wait-btn {
    background: linear-gradient(135deg, #ffa500 0%, #0f3460 100%);
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .help-text {
    margin-top: 20px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border-left: 3px solid #0f3460;
  }

  .help-text p {
    font-size: 0.85em;
    color: #cccccc;
    margin: 8px 0;
  }

  .note {
    font-size: 0.85em !important;
    color: #ffa500 !important;
    font-style: italic;
  }
</style>