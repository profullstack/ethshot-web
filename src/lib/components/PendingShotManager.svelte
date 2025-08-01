<script>
  import { onMount } from 'svelte';
  import { gameStore } from '../stores/game/core.js';
  import { walletStore } from '../stores/wallet.js';
  import { revealShot } from '../stores/game/player-operations.js';
  import { toastStore } from '../stores/toast.js';
  import { safeBigIntToNumber } from '../stores/game/utils.js';

  export let contract;
  export let ethers;

  let pendingShot = null;
  let canReveal = false;
  let revealExpired = false;
  let blocksToWait = 0;
  let loading = false;
  let secret = '';
  let showSecretInput = false;

  $: wallet = $walletStore;
  $: state = $gameStore;

  const checkPendingShot = async () => {
    if (!wallet.connected || !contract) return;

    try {
      const hasPending = await contract.hasPendingShot(wallet.address);
      
      if (hasPending) {
        const shotInfo = await contract.getPendingShot(wallet.address);
        const currentBlock = await wallet.provider.getBlockNumber();
        const commitBlock = safeBigIntToNumber(shotInfo.blockNumber);
        const revealDelay = 1; // REVEAL_DELAY from contract
        const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
        
        canReveal = await contract.canRevealShot(wallet.address);
        revealExpired = currentBlock > commitBlock + maxRevealDelay;
        blocksToWait = Math.max(0, (commitBlock + revealDelay) - currentBlock);
        
        pendingShot = {
          exists: true,
          blockNumber: commitBlock,
          amount: ethers.formatEther(shotInfo.amount),
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
    }
  };

  const handleRevealShot = async () => {
    if (!secret.trim()) {
      toastStore.error('Please enter your secret');
      return;
    }

    loading = true;
    try {
      await revealShot({
        secret: secret.trim(),
        state,
        contract,
        ethers,
        wallet,
        db: state.db,
        updateState: gameStore.update,
        loadGameState: () => gameStore.loadGameState(),
        loadPlayerData: (address) => gameStore.loadPlayerData(address),
        walletStore
      });
      
      // Clear the secret and hide input
      secret = '';
      showSecretInput = false;
      
      // Refresh pending shot status
      await checkPendingShot();
    } catch (error) {
      console.error('Failed to reveal shot:', error);
    } finally {
      loading = false;
    }
  };

  const handleCleanupExpired = async () => {
    if (!contract || !wallet.signer) return;

    loading = true;
    try {
      const contractWithSigner = contract.connect(wallet.signer);
      const cleanupTx = await contractWithSigner.cleanupExpiredPendingShot(wallet.address);
      await cleanupTx.wait();
      
      toastStore.success('Expired pending shot cleaned up successfully');
      await checkPendingShot();
    } catch (error) {
      console.error('Failed to cleanup expired shot:', error);
      toastStore.error('Failed to cleanup expired shot: ' + error.message);
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    checkPendingShot();
    
    // Check every 10 seconds
    const interval = setInterval(checkPendingShot, 10000);
    return () => clearInterval(interval);
  });
</script>

{#if pendingShot}
  <div class="pending-shot-manager">
    <div class="pending-shot-info">
      <h3>⏳ Pending Shot</h3>
      <p>You have a pending shot of <strong>{pendingShot.amount} ETH</strong></p>
      <p>Committed at block: <strong>{pendingShot.blockNumber}</strong></p>
      <p>Current block: <strong>{pendingShot.currentBlock}</strong></p>
      
      {#if pendingShot.revealExpired}
        <div class="status expired">
          <p>❌ <strong>Reveal window expired</strong></p>
          <p>This shot can be cleaned up to allow new shots.</p>
          <button 
            class="cleanup-btn"
            on:click={handleCleanupExpired}
            disabled={loading}
          >
            {loading ? 'Cleaning up...' : 'Clean Up Expired Shot'}
          </button>
        </div>
      {:else if pendingShot.canReveal}
        <div class="status ready">
          <p>✅ <strong>Ready to reveal!</strong></p>
          <p>You can now reveal your shot to see if you won.</p>
          
          {#if !showSecretInput}
            <button 
              class="reveal-btn"
              on:click={() => showSecretInput = true}
            >
              Reveal Shot
            </button>
          {:else}
            <div class="secret-input">
              <input 
                type="text" 
                bind:value={secret}
                placeholder="Enter your secret (from when you committed)"
                class="secret-field"
              />
              <div class="secret-actions">
                <button 
                  class="reveal-btn"
                  on:click={handleRevealShot}
                  disabled={loading || !secret.trim()}
                >
                  {loading ? 'Revealing...' : 'Reveal'}
                </button>
                <button 
                  class="cancel-btn"
                  on:click={() => { showSecretInput = false; secret = ''; }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="status waiting">
          <p>⏳ <strong>Waiting for reveal window</strong></p>
          <p>Please wait {pendingShot.blocksToWait} more block(s) before revealing.</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pending-shot-manager {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 2px solid #0f3460;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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

  .cleanup-btn, .reveal-btn {
    background: linear-gradient(135deg, #e94560 0%, #0f3460 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 10px;
  }

  .reveal-btn {
    background: linear-gradient(135deg, #2ed573 0%, #0f3460 100%);
  }

  .cleanup-btn:hover, .reveal-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .cleanup-btn:disabled, .reveal-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .secret-input {
    margin-top: 15px;
  }

  .secret-field {
    width: 100%;
    padding: 12px;
    border: 2px solid #0f3460;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 0.95em;
    margin-bottom: 10px;
  }

  .secret-field::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }

  .secret-field:focus {
    outline: none;
    border-color: #2ed573;
    box-shadow: 0 0 0 3px rgba(46, 213, 115, 0.2);
  }

  .secret-actions {
    display: flex;
    gap: 10px;
  }

  .cancel-btn {
    background: linear-gradient(135deg, #666 0%, #333 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .cancel-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
</style>