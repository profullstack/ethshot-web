<script>
  import { GAME_CONFIG, SOCIAL_CONFIG, formatEth, calculateUSDValue, formatCooldownTime } from '$lib/config.js';
</script>

<svelte:head>
  <title>FAQ - ETH Shot</title>
  <meta name="description" content="Frequently asked questions about ETH Shot - learn how to play, win chances, payouts, and more!" />
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">
  <!-- Header -->
  <div class="text-center space-y-4">
    <h1 class="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
      ❓ FAQ
    </h1>
    <p class="text-xl text-gray-300 max-w-2xl mx-auto">
      Everything you need to know about playing ETH Shot
    </p>
  </div>

  <!-- FAQ Items -->
  <div class="space-y-6">
    <!-- How to Play -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🎯</span>
        <span>How do I play ETH Shot?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>1. Connect your Ethereum wallet (MetaMask, WalletConnect, etc.)</p>
        <p>2. Make sure you have at least {formatEth(GAME_CONFIG.SHOT_COST)} ETH in your wallet</p>
        <p>3. Click the "TAKE THE SHOT" button and confirm the transaction</p>
        <p>4. Wait for the transaction to confirm - you'll see if you won!</p>
      </div>
    </div>

    <!-- Win Chances -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🎲</span>
        <span>What are my chances of winning?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>Each shot has exactly a <strong class="text-yellow-400">{GAME_CONFIG.WIN_PERCENTAGE}% chance</strong> of winning the jackpot.</p>
        <p>This means on average, 1 out of every 100 shots will win the pot.</p>
        <p>The odds are the same for every player and every shot - it's completely fair!</p>
      </div>
    </div>

    <!-- Payouts -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>💰</span>
        <span>How much can I win?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>When you win, you receive <strong class="text-green-400">{GAME_CONFIG.WINNER_PAYOUT_PERCENTAGE}% of the current pot</strong> directly to your wallet.</p>
        <p>The remaining {GAME_CONFIG.HOUSE_FEE_PERCENTAGE}% goes to platform maintenance and development.</p>
        <p>The pot grows with every shot taken, so it can get quite large!</p>
      </div>
    </div>

    <!-- Cooldown -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>⏰</span>
        <span>Why is there a cooldown period?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>There's a <strong class="text-blue-400">{formatCooldownTime(GAME_CONFIG.COOLDOWN_HOURS)} cooldown</strong> between shots from the same wallet.</p>
        <p>This prevents spam and ensures fair play for all participants.</p>
        <p>You can see your remaining cooldown time on the game page.</p>
      </div>
    </div>

    <!-- Safety -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🔒</span>
        <span>Is ETH Shot safe and fair?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>Yes! ETH Shot runs on a <strong class="text-purple-400">smart contract</strong> deployed on Ethereum.</p>
        <p>All game logic is transparent and verifiable on the blockchain.</p>
        <p>The random number generation uses blockchain-based randomness for fairness.</p>
        <p>You can view the contract code and all transactions on Etherscan.</p>
      </div>
    </div>

    <!-- Costs -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>💸</span>
        <span>What does it cost to play?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>Each shot costs exactly <strong class="text-yellow-400">{formatEth(GAME_CONFIG.SHOT_COST)} ETH</strong> (about ${calculateUSDValue(GAME_CONFIG.SHOT_COST)} USD).</p>
        <p>You'll also pay standard Ethereum gas fees for the transaction.</p>
        <p>Gas fees vary based on network congestion, typically .20-.75 USD.</p>
      </div>
    </div>

    <!-- Sponsorship -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🎪</span>
        <span>What is sponsorship?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>Players can sponsor a round for <strong class="text-purple-400">{formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH</strong> to get their name/logo displayed.</p>
        <p>Sponsorship gives you visibility to all players and supports the platform.</p>
        <p>Perfect for promoting your project, brand, or just having fun!</p>
      </div>
    </div>

    <!-- Network Issues -->
    <div class="bg-yellow-900/30 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/50">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🌐</span>
        <span>Why does the pot show zero ETH?</span>
      </h2>
      <div class="text-gray-300 space-y-3">
        <div class="bg-yellow-800/30 border border-yellow-500/30 rounded-lg p-4">
          <p class="font-semibold text-yellow-300 mb-2">🧪 Important: ETH Shot runs on Sepolia Testnet</p>
          <p class="text-sm">If you see "0 ETH" in the pot, your wallet is likely connected to Ethereum Mainnet instead of Sepolia Testnet.</p>
        </div>
        <div class="space-y-2">
          <p><strong class="text-white">To fix this:</strong></p>
          <p>1. Connect your wallet - we'll automatically detect if you're on the wrong network</p>
          <p>2. When prompted, click "Switch to Sepolia Testnet" in the popup</p>
          <p>3. Approve the network switch in your wallet</p>
          <p>4. The pot amount should now display correctly!</p>
        </div>
        <div class="bg-blue-800/30 border border-blue-500/30 rounded-lg p-3">
          <p class="text-blue-300 text-sm">
            <strong>Need testnet ETH?</strong> Get free Sepolia ETH from faucets like
            <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-200">sepoliafaucet.com</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Technical Issues -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>🔧</span>
        <span>What if I have technical issues?</span>
      </h2>
      <div class="text-gray-300 space-y-2">
        <p>Make sure you're connected to <strong class="text-yellow-400">Sepolia Testnet</strong> (not Ethereum Mainnet).</p>
        <p>Ensure your wallet has enough testnet ETH for both the shot cost and gas fees.</p>
        <p>Try refreshing the page if the wallet connection seems stuck.</p>
        <p>Check your transaction on <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">Sepolia Etherscan</a> if you're unsure about its status.</p>
      </div>
    </div>

    <!-- Supported Wallets -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 class="text-2xl font-bold text-white mb-4 flex items-center space-x-3">
        <span>👛</span>
        <span>Which wallets are supported?</span>
      </h2>
      <div class="text-gray-300 space-y-4">
        <p>ETH Shot supports all major Ethereum wallets. Here are the most popular options:</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"
          >
            <img src="/icons/metamask.svg" alt="MetaMask" class="w-8 h-8" />
            <div>
              <div class="font-semibold text-white">MetaMask</div>
              <div class="text-sm text-gray-400">Browser extension & mobile app</div>
            </div>
          </a>
          <a
            href="https://walletconnect.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"
          >
            <img src="/icons/walletconnect.svg" alt="WalletConnect" class="w-8 h-8" />
            <div>
              <div class="font-semibold text-white">WalletConnect</div>
              <div class="text-sm text-gray-400">Connect any mobile wallet</div>
            </div>
          </a>
          <a
            href="https://www.coinbase.com/wallet"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"
          >
            <img src="/icons/coinbase.svg" alt="Coinbase Wallet" class="w-8 h-8" />
            <div>
              <div class="font-semibold text-white">Coinbase Wallet</div>
              <div class="text-sm text-gray-400">Self-custody wallet</div>
            </div>
          </a>
          <a
            href="https://trustwallet.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"
          >
            <img src="/icons/trust.svg" alt="Trust Wallet" class="w-8 h-8" />
            <div>
              <div class="font-semibold text-white">Trust Wallet</div>
              <div class="text-sm text-gray-400">Mobile-first wallet</div>
            </div>
          </a>
        </div>
        <p class="text-sm text-gray-400">
          Don't have a wallet? Click any of the links above to download and set up your preferred wallet.
        </p>
      </div>
    </div>
  </div>

  <!-- Still Have Questions -->
  <div class="bg-gradient-to-r from-red-600/20 to-purple-600/20 rounded-xl p-8 border border-red-500/30 text-center">
    <h2 class="text-2xl font-bold text-white mb-4">Still Have Questions?</h2>
    <p class="text-gray-300 mb-6">
      Join our community or check out the game to learn more!
    </p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a 
        href="/" 
        class="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
      >
        <span>🎯</span>
        <span>Play Now</span>
      </a>
      <a
        href={SOCIAL_CONFIG.DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
      >
        <span>💬</span>
        <span>Join Discord</span>
      </a>
    </div>
  </div>
</div>