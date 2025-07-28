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
    if (!wallet.connected || !wallet.contract || checkingStatus) return;

    checkingStatus = true;
    try {
      const hasPending = await wallet.contract.hasPendingShot(wallet.address);
      
      if (hasPending) {
        const shotInfo = await wallet.contract.getPendingShot(wallet.address);
        const currentBlock = await wallet.provider.getBlockNumber();
        const commitBlock = Number(shotInfo.blockNumber);
        const revealDelay = 1; // REVEAL_DELAY from contract
        const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
        
        const canReveal = currentBlock > commitBlock + revealDelay;
        const revealExpired = currentBlock > commitBlock + maxRevealDelay;
        const blocksToWait = Math.max(0, (commitBlock + revealDelay) - currentBlock);
        
        pendingShot = {
          exists: true,
          blockNumber: commitBlock,
          amount: wallet.ethers.formatEther(shotInfo.amount),
          currentBlock,
          canReveal,
          revealExpired,
          blocksToWait
        };
      } else {
        pendingShot = null;
      }
    } catch (error) {
      console.error('Failed to check pending shot:', error);
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
    toastStore.info(`Please wait ${pendingShot.blocksToWait} more block(s) for the reveal window to open.`);
  };

  onMount(() => {
    checkPendingShot();
    
    // Check every 15 seconds
    const interval = setInterval(checkPendingShot, 15000);
    return () => clearInterval(interval);
  });

  // Re-check when wallet connects or contract changes
  $: if (wallet.connected && wallet.contract) {
    checkPendingShot();
  }
</script>

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
          <button 
            class="action-btn refresh-btn"
            on:click={handleRefreshPage}
            disabled={loading}
          >
            Refresh Page to Clear
          </button>
        </div>
      {:else if pendingShot.canReveal}
        <div class="status ready">
          <p>✅ <strong>Ready to reveal!</strong></p>
          <p>Your shot is ready to be revealed, but you'll need the secret from when you committed.</p>
          <p class="note">💡 <strong>Note:</strong> The reveal functionality requires your original secret. If you don't have it, refresh the page to start over.</p>
          <button 
            class="action-btn refresh-btn"
            on:click={handleRefreshPage}
            disabled={loading}
          >
            Refresh Page to Start Over
          </button>
        </div>
      {:else}
        <div class="status waiting">
          <p>⏳ <strong>Waiting for reveal window</strong></p>
          <p>Please wait {pendingShot.blocksToWait} more block(s) before the reveal window opens.</p>
          <button 
            class="action-btn wait-btn"
            on:click={handleWaitForBlocks}
            disabled={loading}
          >
            Wait for Reveal Window
          </button>
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

  .refresh-btn {
    background: linear-gradient(135deg, #2ed573 0%, #0f3460 100%);
  }

  .wait-btn {
    background: linear-gradient(135deg, #ffa500 0%, #0f3460 100%);
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