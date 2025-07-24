<script>
  import { onMount } from 'svelte';
  import { gameStore } from '../stores/game-unified.js';

  let permissionStatus = 'default';
  let showPrompt = false;
  let isLoading = false;

  onMount(() => {
    // Check initial permission status
    permissionStatus = gameStore.getNotificationPermissionStatus();
    
    // Show prompt if notifications are not enabled and user hasn't denied
    showPrompt = permissionStatus === 'default';
  });

  async function requestPermission() {
    isLoading = true;
    try {
      const granted = await gameStore.requestNotificationPermission();
      permissionStatus = granted ? 'granted' : 'denied';
      showPrompt = false;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      isLoading = false;
    }
  }

  function dismissPrompt() {
    showPrompt = false;
  }
</script>

{#if showPrompt}
  <div class="notification-prompt">
    <div class="prompt-content">
      <div class="prompt-icon">🔔</div>
      <div class="prompt-text">
        <h3>Stay in the Game!</h3>
        <p>Get notified when your cooldown ends, someone wins the jackpot, or the pot reaches new milestones.</p>
      </div>
      <div class="prompt-actions">
        <button 
          class="btn-primary" 
          on:click={requestPermission}
          disabled={isLoading}
        >
          {isLoading ? 'Enabling...' : 'Enable Notifications'}
        </button>
        <button 
          class="btn-secondary" 
          on:click={dismissPrompt}
          disabled={isLoading}
        >
          Maybe Later
        </button>
      </div>
    </div>
  </div>
{/if}

{#if permissionStatus === 'granted'}
  <div class="notification-status enabled">
    <span class="status-icon">✅</span>
    <span class="status-text">Notifications enabled</span>
  </div>
{:else if permissionStatus === 'denied'}
  <div class="notification-status disabled">
    <span class="status-icon">🔕</span>
    <span class="status-text">Notifications disabled</span>
    <button class="btn-link" on:click={() => showPrompt = true}>
      Enable in browser settings
    </button>
  </div>
{/if}

<style>
  .notification-prompt {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    max-width: 320px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .prompt-content {
    color: white;
  }

  .prompt-icon {
    font-size: 2rem;
    text-align: center;
    margin-bottom: 12px;
  }

  .prompt-text h3 {
    margin: 0 0 8px 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .prompt-text p {
    margin: 0 0 16px 0;
    font-size: 0.9rem;
    line-height: 1.4;
    opacity: 0.9;
  }

  .prompt-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-primary {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .notification-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    margin: 10px 0;
  }

  .notification-status.enabled {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .notification-status.disabled {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .btn-link {
    background: none;
    border: none;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
    font-size: inherit;
    padding: 0;
    margin-left: 8px;
  }

  .btn-link:hover {
    opacity: 0.8;
  }

  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .notification-prompt {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>