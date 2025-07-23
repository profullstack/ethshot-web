<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Terms of Service - ETH Shot</title>
  <meta name="description" content="Terms of Service for ETH Shot" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">
  <div class="text-center space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
      📋 Terms of Service
    </h1>
    <p class="text-xl text-gray-300">Last updated: Coming Soon</p>
  </div>

  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <div class="text-center space-y-6">
      <div class="text-6xl">⚖️</div>
      <h2 class="text-2xl font-bold text-white">Legal Documents Coming Soon</h2>
      <p class="text-gray-300 max-w-2xl mx-auto">
        We're working on comprehensive terms of service to ensure transparency and legal compliance. 
        Please check back soon for our complete legal documentation.
      </p>
      
      <div class="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mt-6">
        <p class="text-yellow-300 text-sm">
          <strong>Important:</strong> By using ETH Shot, you acknowledge that this is experimental software. 
          Only play with funds you can afford to lose. Gambling may be restricted in your jurisdiction.
        </p>
      </div>
    </div>
  </div>

  <div class="text-center">
    <button on:click={() => goto('/')} class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold">
      ← Back to Game
    </button>
  </div>
</div>