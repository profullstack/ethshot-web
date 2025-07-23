<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Statistics - ETH Shot</title>
  <meta name="description" content="Game statistics and analytics for ETH Shot" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8 text-center">
  <div class="space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
      📊 Statistics
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      Detailed game statistics coming soon! Check the leaderboard for current player rankings.
    </p>
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <a href="/leaderboard" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🏆</div>
      <h3 class="text-xl font-bold text-white mb-2">Leaderboard</h3>
      <p class="text-gray-300">View top players and winners</p>
    </a>

    <a href="/" class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-colors group">
      <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
      <h3 class="text-xl font-bold text-white mb-2">Play Now</h3>
      <p class="text-gray-300">Start playing ETH Shot</p>
    </a>
  </div>

  <button on:click={() => goto('/')} class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold">
    ← Back to Game
  </button>
</div>