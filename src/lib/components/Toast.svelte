<script>
  import { toastStore } from '../stores/toast.js';
  import { fly } from 'svelte/transition';

  // Toast type icons
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // Toast type styles
  const getTypeClass = (type) => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'error':
        return 'toast-error';
      case 'warning':
        return 'toast-warning';
      case 'info':
      default:
        return 'toast-info';
    }
  };

  // Remove toast
  const removeToast = (id) => {
    toastStore.remove(id);
  };
</script>

<!-- Toast Container -->
<div class="fixed top-4 right-4 z-100 space-y-2 max-w-sm">
  {#each $toastStore as toast (toast.id)}
    <div
      class="toast {getTypeClass(toast.type)}"
      transition:fly={{ x: 300, duration: 300 }}
    >
      <div class="flex items-start space-x-3">
        <!-- Icon -->
        <div class="flex-shrink-0 text-lg">
          {getIcon(toast.type)}
        </div>
        
        <!-- Message -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">
            {toast.message}
          </p>
        </div>
        
        <!-- Close Button -->
        <button
          on:click={() => removeToast(toast.id)}
          class="flex-shrink-0 text-white/70 hover:text-white transition-colors"
          aria-label="Close notification"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  {/each}
</div>

<style>
  .toast {
    @apply p-4 rounded-lg shadow-lg backdrop-blur-sm border;
    animation: slideIn 0.3s ease-out;
  }

  .toast-success {
    @apply bg-green-600/90 border-green-500;
  }

  .toast-error {
    @apply bg-red-600/90 border-red-500;
  }

  .toast-warning {
    @apply bg-yellow-600/90 border-yellow-500;
  }

  .toast-info {
    @apply bg-blue-600/90 border-blue-500;
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
</style>