<script>
  // Props
  export let isConnected = false;
  export let debugMode = false;
  export let canTakeShot = false;
  export let cooldownRemaining = 0;
  export let currentPot = '0';
  export let isLoading = false;

  // Event handlers (passed from parent)
  export let onManualRefresh;
  export let onCheckPendingShot;
  export let onDeepDebug;
  export let onCleanupExpiredShot;
</script>

{#if isConnected && debugMode}
  <div class="flex flex-col space-y-2">
    <div class="text-xs text-gray-400 text-center">
      Debug: canShoot={canTakeShot}, cooldown={cooldownRemaining}s, pot={currentPot}
    </div>
    <div class="flex flex-col space-y-2">
      <button
        on:click={onManualRefresh}
        class="btn-debug"
        disabled={isLoading}
      >
        🔄 Refresh Player Data
      </button>
      <button
        on:click={onCheckPendingShot}
        class="btn-debug"
        disabled={isLoading}
      >
        🔍 Check Pending Shots
      </button>
      <button
        on:click={onDeepDebug}
        class="btn-debug"
        disabled={isLoading}
      >
        🔧 Deep Debug
      </button>
      <button
        on:click={onCleanupExpiredShot}
        class="btn-debug"
        disabled={isLoading}
      >
        🧹 Cleanup Expired Shot
      </button>
    </div>
  </div>
{/if}

<style>
  .btn-debug {
    @apply px-4 py-2 text-xs font-medium text-gray-300;
    @apply bg-gray-700 hover:bg-gray-600 border border-gray-600;
    @apply rounded-lg transition-colors duration-200;
    @apply focus:outline-none focus:ring-2 focus:ring-gray-500;
  }

  .btn-debug:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
</style>