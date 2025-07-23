<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Risk Disclaimer - ETH Shot</title>
  <meta name="description" content="Risk disclaimer and important information about playing ETH Shot" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">
  <div class="text-center space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
      ⚠️ Risk Disclaimer
    </h1>
    <p class="text-xl text-gray-300">Important information before you play</p>
  </div>

  <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-8">
    <div class="text-center space-y-6">
      <div class="text-6xl">🚨</div>
      <h2 class="text-2xl font-bold text-white">Play Responsibly</h2>
      <div class="text-red-300 space-y-4 text-left max-w-2xl mx-auto">
        <p><strong>⚠️ High Risk Activity:</strong> ETH Shot is a gambling game with real financial risk. You can lose all ETH you spend.</p>
        <p><strong>💸 Only Play What You Can Afford:</strong> Never play with money you need for essentials like rent, food, or bills.</p>
        <p><strong>🎲 Low Win Probability:</strong> Each shot has only a 1% chance of winning. Most players will lose their ETH.</p>
        <p><strong>⛓️ Blockchain Risks:</strong> Smart contracts can have bugs. Transactions are irreversible.</p>
        <p><strong>📍 Legal Compliance:</strong> Gambling may be illegal in your jurisdiction. Check local laws.</p>
        <p><strong>🧠 Addiction Warning:</strong> Gambling can be addictive. Seek help if you can't control your playing.</p>
      </div>
    </div>
  </div>

  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-2xl font-bold text-white mb-6 text-center">Technical Risks</h2>
    <div class="grid md:grid-cols-2 gap-6 text-gray-300">
      <div>
        <h3 class="text-lg font-semibold text-white mb-3">Smart Contract Risks</h3>
        <ul class="space-y-2 text-sm">
          <li>• Contract bugs could cause loss of funds</li>
          <li>• No insurance or guarantees</li>
          <li>• Transactions cannot be reversed</li>
        </ul>
      </div>
      <div>
        <h3 class="text-lg font-semibold text-white mb-3">Network Risks</h3>
        <ul class="space-y-2 text-sm">
          <li>• High gas fees during network congestion</li>
          <li>• Transaction failures can still cost gas</li>
          <li>• Network outages may prevent access</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
    <h3 class="text-xl font-bold text-white mb-4 text-center">🆘 Need Help?</h3>
    <div class="text-center text-blue-300">
      <p class="mb-4">If you're struggling with gambling addiction, please seek help:</p>
      <div class="space-y-2 text-sm">
        <p>🇺🇸 National Problem Gambling Helpline: 1-800-522-4700</p>
        <p>🌐 International: <a href="https://www.begambleaware.org" target="_blank" class="underline hover:text-blue-200">BeGambleAware.org</a></p>
      </div>
    </div>
  </div>

  <div class="text-center space-y-4">
    <p class="text-gray-400 text-sm max-w-2xl mx-auto">
      By using ETH Shot, you acknowledge that you understand these risks and agree to play responsibly. 
      This is experimental software provided "as is" without warranties.
    </p>
    <button on:click={() => goto('/')} class="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-colors font-semibold">
      ← Back to Game
    </button>
  </div>
</div>