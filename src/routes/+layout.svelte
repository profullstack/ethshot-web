<script>
  import '../styles/global.css';
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/stores/wallet.js';
  import { gameStore } from '$lib/stores/game/index.js';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import ChatWidget from '$lib/components/ChatWidget.svelte';
  import UserProfile from '$lib/components/UserProfile.svelte';

  // Profile modal state
  let showProfileModal = false;

  onMount(() => {
    // Initialize wallet connection on app load
    walletStore.init();
    
    // Initialize game state
    gameStore.init();

    // Global event listener for opening profile modal
    const handleOpenProfileModal = (event) => {
      showProfileModal = true;
    };

    window.addEventListener('OpenProfileModal', handleOpenProfileModal);

    // Cleanup event listener
    return () => {
      window.removeEventListener('OpenProfileModal', handleOpenProfileModal);
    };
  });

  const handleCloseProfile = () => {
    showProfileModal = false;
  };
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
  <!-- Background Pattern -->
  <div class="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
  
  <!-- Main App Structure -->
  <div class="relative z-10 flex flex-col min-h-screen">
    <Header />
    
    <main class="flex-1 container mx-auto px-4 py-8">
      <slot />
    </main>
    
    <Footer />
  </div>
  
  <!-- Toast Notifications -->
  <Toast />
  
  <!-- Chat Widget -->
  <ChatWidget />
  
  <!-- Profile Modal -->
  <UserProfile show={showProfileModal} on:close={handleCloseProfile} />
</div>

<style>
  :global(html) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  :global(.container) {
    max-width: 1200px;
  }
  
  /* Custom scrollbar */
  :global(::-webkit-scrollbar) {
    width: 8px;
  }
  
  :global(::-webkit-scrollbar-track) {
    background: rgba(255, 255, 255, 0.1);
  }
  
  :global(::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }
  
  :global(::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.5);
  }
</style>