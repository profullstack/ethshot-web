<script>
  import { GAME_CONFIG, formatEth, calculateUSDValue } from '$lib/config.js';
  import MetaTags from '$lib/components/MetaTags.svelte';
</script>

<MetaTags
  title="About ETH Shot - Learn How to Win ETH Jackpots"
  description="Learn about ETH Shot - the viral Ethereum-powered game where you can win ETH jackpots with just one click! Transparent, fair, and instant payouts."
  keywords="ethereum, eth, jackpot, game, crypto, blockchain, about, how it works, transparent, fair"
  type="website"
/>

<div class="max-w-4xl mx-auto space-y-12">
  <!-- Header -->
  <div class="text-center space-y-6">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 bg-clip-text text-transparent">
      About ETH Shot
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      The viral, pay-to-play, Ethereum-powered game where one click could change everything
    </p>
  </div>

  <!-- What is ETH Shot -->
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-3xl font-bold text-white mb-6 flex items-center space-x-3">
      <span>🎯</span>
      <span>What is ETH Shot?</span>
    </h2>
    <div class="space-y-4 text-gray-300 text-lg leading-relaxed">
      <p>
        ETH Shot is a simple yet thrilling blockchain game built on Ethereum. With just {formatEth(GAME_CONFIG.SHOT_COST)} ETH (about ${calculateUSDValue(GAME_CONFIG.SHOT_COST)}),
        you can take a shot at winning the entire jackpot pot. Every click has a {GAME_CONFIG.WIN_PERCENTAGE}% chance to win, making it
        accessible to everyone while keeping the excitement high.
      </p>
      <p>
        The game operates on a transparent smart contract, ensuring fairness and security. When you win,
        you receive {GAME_CONFIG.WINNER_PERCENTAGE}% of the current pot instantly to your wallet, while {GAME_CONFIG.HOUSE_FEE_PERCENTAGE}% goes to maintaining the platform.
      </p>
    </div>
  </div>

  <!-- How It Works -->
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-3xl font-bold text-white mb-6 flex items-center space-x-3">
      <span>⚙️</span>
      <span>How It Works</span>
    </h2>
    <div class="grid md:grid-cols-2 gap-8">
      <div class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">1</div>
          <div>
            <h3 class="text-xl font-semibold text-white mb-2">Connect Your Wallet</h3>
            <p class="text-gray-300">Connect your Ethereum wallet (MetaMask, WalletConnect, etc.) to get started.</p>
          </div>
        </div>
        <div class="flex items-start space-x-4">
          <div class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">2</div>
          <div>
            <h3 class="text-xl font-semibold text-white mb-2">Take Your Shot</h3>
            <p class="text-gray-300">Pay {formatEth(GAME_CONFIG.SHOT_COST)} ETH and click the button. Each shot has a {GAME_CONFIG.WIN_PERCENTAGE}% chance to win the entire pot!</p>
          </div>
        </div>
      </div>
      <div class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">3</div>
          <div>
            <h3 class="text-xl font-semibold text-white mb-2">Win or Try Again</h3>
            <p class="text-gray-300">If you win, {GAME_CONFIG.WINNER_PERCENTAGE}% of the pot goes directly to your wallet. If not, wait {GAME_CONFIG.COOLDOWN_HOURS} hour and try again!</p>
          </div>
        </div>
        <div class="flex items-start space-x-4">
          <div class="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">4</div>
          <div>
            <h3 class="text-xl font-semibold text-white mb-2">Share & Repeat</h3>
            <p class="text-gray-300">Share your wins on social media and keep playing to climb the leaderboard!</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Game Statistics -->
  <div class="grid md:grid-cols-3 gap-6">
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
      <div class="text-3xl font-bold text-yellow-400 mb-2">{formatEth(GAME_CONFIG.SHOT_COST)} ETH</div>
      <div class="text-gray-300">Cost Per Shot</div>
    </div>
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
      <div class="text-3xl font-bold text-green-400 mb-2">{GAME_CONFIG.WIN_PERCENTAGE}%</div>
      <div class="text-gray-300">Win Chance</div>
    </div>
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 text-center">
      <div class="text-3xl font-bold text-blue-400 mb-2">{GAME_CONFIG.WINNER_PERCENTAGE}%</div>
      <div class="text-gray-300">Winner Payout</div>
    </div>
  </div>

  <!-- Why ETH Shot -->
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-gray-700">
    <h2 class="text-3xl font-bold text-white mb-6 flex items-center space-x-3">
      <span>💎</span>
      <span>Why ETH Shot?</span>
    </h2>
    <div class="grid md:grid-cols-2 gap-8">
      <div class="space-y-4">
        <div class="flex items-start space-x-3">
          <span class="text-green-400 text-xl">✓</span>
          <div>
            <h4 class="text-lg font-semibold text-white">Transparent & Fair</h4>
            <p class="text-gray-300">Built on Ethereum smart contracts - every transaction is verifiable on the blockchain.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <span class="text-green-400 text-xl">✓</span>
          <div>
            <h4 class="text-lg font-semibold text-white">Low Entry Cost</h4>
            <p class="text-gray-300">At just {formatEth(GAME_CONFIG.SHOT_COST)} ETH per shot, anyone can afford to play and potentially win big.</p>
          </div>
        </div>
      </div>
      <div class="space-y-4">
        <div class="flex items-start space-x-3">
          <span class="text-green-400 text-xl">✓</span>
          <div>
            <h4 class="text-lg font-semibold text-white">Instant Payouts</h4>
            <p class="text-gray-300">Winners receive their ETH immediately - no waiting, no middlemen.</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <span class="text-green-400 text-xl">✓</span>
          <div>
            <h4 class="text-lg font-semibold text-white">Community Driven</h4>
            <p class="text-gray-300">Join a growing community of players and share your wins on social media.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Call to Action -->
  <div class="text-center space-y-6">
    <h2 class="text-3xl font-bold text-white">Ready to Take Your Shot?</h2>
    <p class="text-xl text-gray-300">Join thousands of players who've already taken their chance at the ETH jackpot!</p>
    <a 
      href="/" 
      class="inline-flex items-center space-x-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg transition-colors font-bold text-lg"
    >
      <span>🎯</span>
      <span>Play ETH Shot Now</span>
    </a>
  </div>
</div>