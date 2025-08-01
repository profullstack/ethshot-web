<script>
  import { analyzePotentialWin, getWalletWarningExplanation } from '../utils/ethshot-win-prediction.js';

  // Props
  export let showRevealModal = false;
  export let pendingSecret = null;
  export let pendingTxHash = null;
  export let revealingShot = false;
  export let savingToLocalStorage = false;
  export let copyingToClipboard = false;
  export let gameState = {};

  // Event handlers (passed from parent)
  export let onClose;
  export let onRevealNow;
  export let onSaveToLocalStorage;
  export let onSaveForLater;

  let showWalletWarningInfo = false;

  // Analyze potential win and wallet warning expectations
  $: winAnalysis = gameState && gameState.currentPot ?
    analyzePotentialWin(gameState, gameState.playerAddress) :
    { canWin: false, walletWarningExpected: false, recommendation: 'Loading...' };

  const toggleWalletWarningInfo = () => {
    showWalletWarningInfo = !showWalletWarningInfo;
  };
</script>

{#if showRevealModal}
  <div class="modal-overlay" on:click|self={onClose}>
    <div class="reveal-modal">
      <div class="modal-header">
        <h2>🎯 Shot Committed Successfully!</h2>
        <button
          class="close-btn"
          on:click={onClose}
          disabled={revealingShot}
        >
          ✕
        </button>
      </div>
      
      <div class="modal-content">
        <p class="success-message">
          Your shot has been committed to the blockchain! Now you need to reveal it to see if you won.
        </p>
        
        {#if pendingTxHash}
          <div class="tx-info">
            <p><strong>Transaction:</strong> <code class="tx-hash">{pendingTxHash.slice(0, 10)}...{pendingTxHash.slice(-8)}</code></p>
          </div>
        {/if}
        
        <div class="secret-info">
          <p><strong>Your Secret:</strong></p>
          <div class="secret-display">
            {#if pendingSecret}
              <code class="secret-code">{pendingSecret}</code>
            {:else}
              <div class="error-message">
                <p class="text-red-400">❌ No secret available</p>
                <p class="text-sm text-gray-400">The secret was not properly saved. Check the debug panel for saved secrets in localStorage.</p>
              </div>
            {/if}
          </div>
          {#if pendingSecret}
            <p class="secret-warning">
              ⚠️ <strong>Important:</strong> Save this secret! You'll need it to reveal your shot if you don't do it now.
            </p>
          {/if}
        </div>

        {#if winAnalysis.walletWarningExpected}
          <div class="wallet-warning-info">
            <div class="warning-header">
              <span class="warning-icon">⚠️</span>
              <span class="warning-title">Wallet Warning Expected</span>
              <button
                class="info-toggle-btn"
                on:click={toggleWalletWarningInfo}
                type="button"
              >
                {showWalletWarningInfo ? '▼' : '▶'}
              </button>
            </div>
            
            <div class="win-analysis">
              <p class="analysis-text">{winAnalysis.recommendation}</p>
            </div>

            {#if showWalletWarningInfo}
              <div class="warning-details">
                <p class="warning-explanation">
                  🎯 <strong>Your wallet may show "insufficient funds" warning</strong>
                </p>
                <ul class="warning-reasons">
                  <li>• Wallet only sees gas cost going out</li>
                  <li>• Cannot predict you might WIN ETH back</li>
                  <li>• Contract sends winnings automatically if you win</li>
                </ul>
                <p class="safety-message">
                  ✅ <strong>This warning is SAFE to ignore for reveals</strong><br>
                  ✅ Transaction will succeed and you'll get winnings if you win! 🚀
                </p>
              </div>
            {/if}
          </div>
        {:else}
          <div class="no-warning-info">
            <p class="no-warning-text">
              ℹ️ No wallet warnings expected for this reveal
            </p>
          </div>
        {/if}
        
        {#if revealingShot}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Communicating with blockchain...</span>
            </div>
          </div>
        {/if}
        
        {#if savingToLocalStorage}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Saving to browser storage...</span>
            </div>
          </div>
        {/if}
        
        {#if copyingToClipboard}
          <div class="status-message">
            <div class="flex items-center space-x-2">
              <div class="spinner-small"></div>
              <span>Copying to clipboard...</span>
            </div>
          </div>
        {/if}
        
        <div class="modal-actions">
          <button
            class="reveal-now-btn"
            on:click={onRevealNow}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard || !pendingSecret}
          >
            {#if revealingShot}
              <div class="spinner-small"></div>
              Revealing...
            {:else if !pendingSecret}
              ❌ No Secret Available
            {:else}
              🎲 Reveal Now
            {/if}
          </button>
          
          <button
            class="save-storage-btn"
            on:click={onSaveToLocalStorage}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard || !pendingSecret || !pendingTxHash}
          >
            {#if savingToLocalStorage}
              <div class="spinner-small"></div>
              Saving...
            {:else if !pendingSecret || !pendingTxHash}
              ❌ Missing Data
            {:else}
              💾 Save to Browser
            {/if}
          </button>
          
          <button
            class="save-clipboard-btn"
            on:click={onSaveForLater}
            disabled={revealingShot || savingToLocalStorage || copyingToClipboard || !pendingSecret}
          >
            {#if copyingToClipboard}
              <div class="spinner-small"></div>
              Copying...
            {:else if !pendingSecret}
              ❌ No Secret
            {:else}
              📋 Copy to Clipboard
            {/if}
          </button>
        </div>
        
        <div class="modal-footer">
          <p class="footer-text">
            You can reveal your shot anytime within 256 blocks (~51-85 minutes) after committing.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Reveal Modal Styles */
  .modal-overlay {
    @apply fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50;
    backdrop-filter: blur(4px);
  }

  .reveal-modal {
    @apply bg-gray-900 border-2 border-red-500 rounded-2xl p-6 max-w-md w-full mx-4;
    @apply shadow-2xl;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    @apply flex justify-between items-center mb-4;
  }

  .modal-header h2 {
    @apply text-xl font-bold text-green-400 m-0;
  }

  .close-btn {
    @apply text-gray-400 hover:text-white text-xl font-bold;
    @apply w-8 h-8 flex items-center justify-center rounded-full;
    @apply hover:bg-gray-700 transition-colors duration-200;
    @apply border-none bg-transparent cursor-pointer;
  }

  .close-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .modal-content {
    @apply text-white;
  }

  .success-message {
    @apply text-green-300 mb-4 text-sm leading-relaxed;
  }

  .tx-info {
    @apply bg-gray-800 rounded-lg p-3 mb-4;
  }

  .tx-info p {
    @apply text-sm text-gray-300 m-0;
  }

  .tx-hash {
    @apply bg-gray-700 px-2 py-1 rounded text-xs font-mono text-blue-300;
  }

  .secret-info {
    @apply bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4 mb-4;
  }

  .secret-info p {
    @apply text-sm text-yellow-200 m-0 mb-2;
  }

  .secret-display {
    @apply bg-gray-800 rounded-lg p-3 mb-3;
  }

  .secret-code {
    @apply font-mono text-lg text-green-400 font-bold;
    word-break: break-all;
  }

  .secret-warning {
    @apply text-xs text-yellow-300 font-medium;
  }

  .modal-actions {
    @apply flex flex-col gap-2 mb-4;
  }

  .reveal-now-btn {
    @apply w-full bg-gradient-to-r from-green-500 to-green-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-green-400 hover:to-green-500 transition-all duration-200;
    @apply border-none cursor-pointer;
    @apply flex items-center justify-center gap-2;
  }

  .save-storage-btn {
    @apply w-full bg-gradient-to-r from-purple-500 to-purple-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-purple-400 hover:to-purple-500 transition-all duration-200;
    @apply border-none cursor-pointer;
  }

  .save-clipboard-btn {
    @apply w-full bg-gradient-to-r from-blue-500 to-blue-600;
    @apply text-white font-bold py-3 px-4 rounded-lg;
    @apply hover:from-blue-400 hover:to-blue-500 transition-all duration-200;
    @apply border-none cursor-pointer;
  }

  .reveal-now-btn:disabled,
  .save-storage-btn:disabled,
  .save-clipboard-btn:disabled {
    @apply opacity-60 cursor-not-allowed;
  }

  .spinner-small {
    @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
  }

  .modal-footer {
    @apply border-t border-gray-700 pt-3;
  }

  .footer-text {
    @apply text-xs text-gray-400 text-center m-0;
  }

  .status-message {
    @apply bg-gray-800 rounded-lg p-3 mb-4 text-center;
  }

  .status-message span {
    @apply text-sm text-blue-300 font-medium;
  }

  /* Wallet Warning Info Styles */
  .wallet-warning-info {
    @apply bg-orange-900 bg-opacity-30 border border-orange-600 rounded-lg p-4 mb-4;
  }

  .no-warning-info {
    @apply bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-3 mb-4;
  }

  .warning-header {
    @apply flex items-center justify-between mb-2;
  }

  .warning-icon {
    @apply text-orange-400 text-lg;
  }

  .warning-title {
    @apply text-orange-200 font-semibold text-sm flex-1 ml-2;
  }

  .info-toggle-btn {
    @apply text-orange-300 hover:text-orange-100 text-sm font-mono;
    @apply bg-transparent border-none cursor-pointer p-1;
    @apply transition-colors duration-200;
  }

  .win-analysis {
    @apply mb-3;
  }

  .analysis-text {
    @apply text-orange-200 text-sm font-medium m-0;
  }

  .warning-details {
    @apply border-t border-orange-700 pt-3 mt-3;
  }

  .warning-explanation {
    @apply text-orange-200 text-sm font-semibold m-0 mb-2;
  }

  .warning-reasons {
    @apply text-orange-300 text-xs list-none p-0 m-0 mb-3;
  }

  .warning-reasons li {
    @apply mb-1;
  }

  .safety-message {
    @apply text-green-300 text-xs font-medium m-0;
    @apply bg-green-900 bg-opacity-40 rounded p-2;
  }

  .no-warning-text {
    @apply text-green-300 text-sm m-0;
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .reveal-modal {
      @apply mx-2 p-4;
    }

    .modal-actions {
      @apply flex-col gap-2;
    }
    
    .reveal-now-btn,
    .save-storage-btn,
    .save-clipboard-btn {
      @apply text-sm py-2;
    }
  }
</style>