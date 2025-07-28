<script>
  import { onMount } from 'svelte';
  import { walletStore } from '../stores/wallet.js';
  import { gameStore } from '../stores/game/core.js';
  import { toastStore } from '../stores/toast.js';

  let pendingShot = null;
  let loading = false;
  let checkingStatus = false;

  $: wallet = $walletStore;
  $: state = $gameStore;

  const checkPendingShot = async () => {
    if (!wallet.connected || !state.contractDeployed || checkingStatus) return;

    checkingStatus = true;
    try {
      console.log('🔍 SimplePendingShotManager: Checking for pending shots...');
      
      // Use gameStore's contract and ethers directly
      let contract = state.contract;
      let provider = wallet.provider;
      let ethers = state.ethers;
      
      if (!contract) {
        console.log('❌ No contract in gameStore, trying wallet.contract as fallback...');
        contract = wallet.contract;
        provider = wallet.provider;
        ethers = wallet.ethers;
        if (!contract) {
          console.log('❌ No contract available in either store!');
          pendingShot = null;
          return;
        }
        console.log('⚠️ Using fallback contract from wallet');
      } else {
        console.log('✅ Using contract from gameStore');
      }

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
          blocksToWait
        };
        
        console.log('✅ Pending shot detected and will be displayed');
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
      await state.cleanupExpiredPendingShot();
      toastStore.success('Expired pending shot cleaned up successfully');
      await checkPendingShot();
    } catch (error) {
      console.error('Failed to cleanup expired shot:', error);
      toastStore.error('Failed to cleanup expired shot: ' + error.message);
      // Fallback to refresh if cleanup fails
      handleRefreshPage();
    } finally {
      loading = false;
    }
  };

  const handleRevealShot = async () => {
    loading = true;
    try {
      // For now, we'll prompt the user for their secret since we don't store it
      const secret = prompt('Enter your secret from when you committed the shot:');
      if (!secret) {
        toastStore.error('Secret is required to reveal the shot');
        return;
      }

      // Call the reveal function from the game store
      await state.revealShot(secret);
      toastStore.success('Shot revealed successfully!');
      await checkPendingShot();
    } catch (error) {
      console.error('Failed to reveal shot:', error);
      toastStore.error('Failed to reveal shot: ' + error.message);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    checkPendingShot();
    
    // Check every 15 seconds
    const interval = setInterval(checkPendingShot, 15000);
    return () => clearInterval(interval);
  });

  // Re-check when wallet connects or contract changes
  $: if (wallet.connected && (state.contract || wallet.contract)) {
    checkPendingShot();
  }
  
  // Also check when gameStore contract becomes available
  $: if (wallet.connected && state.contract && state.ethers) {
    console.log('🔄 GameStore contract became available, checking for pending shots...');
    checkPendingShot();
  }
</script>

<!-- Always Visible Debug Info -->
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
</div>

{#if pendingShot}
  <div class="pending-shot-manager">
    <div class="pending-shot-info">
      <h3>⏳ Pending Shot Detected</h3>
      <p>You have a pending shot of <strong>{pendingShot.amount} ETH</strong></p>
      <p>Committed at block: <strong>{pendingShot.blockNumber}</strong></p>
      <p>Current block: <strong>{pendingShot.currentBlock}</strong></p>
      
      {#if pendingShot.revealExpired}
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
      {:else if pendingShot.canReveal}
        <div class="status ready">
          <p>✅ <strong>Ready to reveal!</strong></p>
          <p>Your shot is ready to be revealed. You'll need the secret from when you committed.</p>
          <div class="button-group">
            <button
              class="action-btn reveal-btn"
              on:click={handleRevealShot}
              disabled={loading}
            >
              {loading ? 'Revealing...' : 'Reveal Pending Shot'}
            </button>
            <button
              class="action-btn refresh-btn secondary"
              on:click={handleRefreshPage}
              disabled={loading}
            >
              Or Start Over (Refresh)
            </button>
          </div>
          <p class="note">💡 <strong>Note:</strong> You'll be prompted for your original secret. If you don't have it, use "Start Over" instead.</p>
        </div>
      {:else}
        <div class="status waiting">
          <p>⏳ <strong>Waiting for reveal window</strong></p>
          <p>Please wait {pendingShot.blocksToWait} more block(s) before the reveal window opens.</p>
          <p class="time-estimate">⏰ <strong>Estimated time:</strong> {getTimeEstimate(pendingShot.blocksToWait)}</p>
          <div class="button-group">
            <button
              class="action-btn refresh-btn"
              on:click={handleRefreshPage}
              disabled={loading}
            >
              Start Over (Refresh Page)
            </button>
            <button
              class="action-btn wait-btn secondary"
              on:click={handleWaitForBlocks}
              disabled={loading}
            >
              Or Wait for Reveal Window
            </button>
          </div>
        </div>
      {/if}
      
      <div class="help-text">
        <p><strong>What happened?</strong> You started a shot but didn't complete the reveal step. This is part of the commit-reveal process that ensures fair randomness.</p>
        <p><strong>Quick fix:</strong> Refresh the page to clear this state and take a new shot.</p>
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