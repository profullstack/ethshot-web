<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>How to Play - ETH Shot</title>
  <meta name="description" content="Learn how to play ETH Shot and win ETH jackpots!" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8 text-center">
  <!-- Header -->
  <div class="space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
      🎮 How to Play
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      This page is coming soon! For now, check out our FAQ or About page for game instructions.
    </p>
  </div>

  <!-- Quick Links -->
  <div class="grid md:grid-cols-3 gap-6">
    <a 
      href="/faq" 
      class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-colors group"
    >
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">❓</div>
      <h3 class="text-xl font-bold text-white mb-2">FAQ</h3>
      <p class="text-gray-300">Get answers to common questions</p>
    </a>

    <a 
      href="/about" 
      class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors group"
    >
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📖</div>
      <h3 class="text-xl font-bold text-white mb-2">About</h3>
      <p class="text-gray-300">Learn about ETH Shot</p>
    </a>

    <a 
      href="/" 
      class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-colors group"
    >
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
      <h3 class="text-xl font-bold text-white mb-2">Play Now</h3>
      <p class="text-gray-300">Start playing ETH Shot</p>
    </a>
  </div>

  <!-- Back Button -->
  <div class="pt-8">
    <button 
      on:click={() => goto('/')}
      class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold"
    >
      ← Back to Game
    </button>
  </div>
</div>