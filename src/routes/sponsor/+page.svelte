<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Sponsor - ETH Shot</title>
  <meta name="description" content="Sponsor a round of ETH Shot and get your brand seen by thousands of players!" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8 text-center">
  <div class="space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500 bg-clip-text text-transparent">
      🎪 Sponsor ETH Shot
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      Sponsorship feature coming soon! Get your brand seen by thousands of players.
    </p>
  </div>

  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-2xl font-bold text-white mb-4">What is Sponsorship?</h2>
    <div class="text-gray-300 space-y-4">
      <p>For just <strong class="text-purple-400">0.05 ETH</strong>, you can sponsor a round and:</p>
      <ul class="text-left max-w-md mx-auto space-y-2">
        <li>• Display your name/brand to all players</li>
        <li>• Show your logo on the game page</li>
        <li>• Add your contribution to the jackpot pot</li>
        <li>• Get visibility in our community</li>
      </ul>
    </div>
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <a href="/" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
      <h3 class="text-xl font-bold text-white mb-2">Play Now</h3>
      <p class="text-gray-300">Try the game first</p>
    </a>

    <a href="/about" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📖</div>
      <h3 class="text-xl font-bold text-white mb-2">Learn More</h3>
      <p class="text-gray-300">About ETH Shot</p>
    </a>
  </div>

  <button on:click={() => goto('/')} class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold">
    ← Back to Game
  </button>
</div>