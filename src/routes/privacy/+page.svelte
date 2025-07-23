<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Privacy Policy - ETH Shot</title>
  <meta name="description" content="Privacy Policy for ETH Shot" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">
  <div class="text-center space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
      🔒 Privacy Policy
    </h1>
    <p class="text-xl text-gray-300">Last updated: Coming Soon</p>
  </div>

  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <div class="text-center space-y-6">
      <div class="text-6xl">🛡️</div>
      <h2 class="text-2xl font-bold text-white">Privacy Policy Coming Soon</h2>
      <p class="text-gray-300 max-w-2xl mx-auto">
        We're preparing a comprehensive privacy policy to explain how we handle your data. 
        Your privacy and security are important to us.
      </p>
      
      <div class="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-6">
        <p class="text-green-300 text-sm">
          <strong>Current Practice:</strong> ETH Shot operates on blockchain technology. 
          Your wallet address and transactions are public on the Ethereum blockchain. 
          We don't collect personal information beyond what's necessary for the game to function.
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