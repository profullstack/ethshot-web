<script>
  import { gameStore } from '../stores/game/index.js';
  import { GAME_CONFIG, SOCIAL_CONFIG, NETWORK_CONFIG, formatEth, formatCooldownTime } from '../config.js';
</script>

<footer class="bg-gray-900 border-t border-gray-800 mt-auto">
  <div class="container mx-auto px-4 py-8">
    <div class="grid md:grid-cols-4 gap-8">
      <!-- Brand -->
      <div class="space-y-4">
        <div class="flex items-center space-x-2">
          <img
            src="/logo.svg"
            alt="ETH Shot Logo"
            class="w-6 h-6"
          />
          <span class="text-lg font-bold gradient-text">ETH SHOT</span>
        </div>
        <p class="text-gray-400 text-sm">
          Take your shot at the ETH jackpot. One click, one chance, endless possibilities.
        </p>
        <div class="flex space-x-4">
          <a
            href={SOCIAL_CONFIG.TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-white transition-colors"
            aria-label="X (formerly Twitter)"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a
            href={SOCIAL_CONFIG.GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-white transition-colors"
            aria-label="GitHub"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <a
            href={SOCIAL_CONFIG.DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-purple-400 transition-colors"
            aria-label="Discord"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
            </svg>
          </a>
        </div>
      </div>

      <!-- Game Info -->
      <div class="space-y-4">
        <h3 class="text-white font-semibold">Game Info</h3>
        <ul class="space-y-2 text-sm text-gray-400">
          <li>
            <span class="text-gray-300">Shot Cost:</span> {formatEth(GAME_CONFIG.SHOT_COST)} ETH
          </li>
          <li>
            <span class="text-gray-300">Win Chance:</span> {GAME_CONFIG.WIN_PERCENTAGE}%
          </li>
          <li>
            <span class="text-gray-300">Winner Gets:</span> {GAME_CONFIG.WINNER_PERCENTAGE}% of pot
          </li>
          <li>
            <span class="text-gray-300">Cooldown:</span> {formatCooldownTime(GAME_CONFIG.COOLDOWN_HOURS)}
          </li>
          <li>
            <span class="text-gray-300">Sponsor Cost:</span> {GAME_CONFIG.SPONSOR_COST_ETH} ETH
          </li>
        </ul>
      </div>

      <!-- Links -->
      <div class="space-y-4">
        <h3 class="text-white font-semibold">Links</h3>
        <ul class="space-y-2 text-sm">
          <li>
            <a href="/how-to-play" class="text-gray-400 hover:text-white transition-colors">
              How to Play
            </a>
          </li>
          <li>
            <a href="/leaderboard" class="text-gray-400 hover:text-white transition-colors">
              Leaderboard
            </a>
          </li>
          <li>
            <a href="/stats" class="text-gray-400 hover:text-white transition-colors">
              Statistics
            </a>
          </li>
          <li>
            <a href="/faq" class="text-gray-400 hover:text-white transition-colors">
              FAQ
            </a>
          </li>
          <li>
            <a
              href="{NETWORK_CONFIG.BLOCK_EXPLORER_URL}/address/{NETWORK_CONFIG.CONTRACT_ADDRESS}"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gray-400 hover:text-white transition-colors"
            >
              Smart Contract ↗
            </a>
          </li>
        </ul>
      </div>

      <!-- Legal -->
      <div class="space-y-4">
        <h3 class="text-white font-semibold">Legal</h3>
        <ul class="space-y-2 text-sm">
          <li>
            <a href="/terms" class="text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </a>
          </li>
          <li>
            <a href="/privacy" class="text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </a>
          </li>
          <li>
            <a href="/disclaimer" class="text-gray-400 hover:text-white transition-colors">
              Risk Disclaimer
            </a>
          </li>
        </ul>
        <p class="text-xs text-gray-500 mt-4">
          Play responsibly. Only gamble what you can afford to lose.
        </p>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
      <div class="text-sm text-gray-400">
        © 2025 Profullstack, Inc. All rights reserved.

      </div>
      
      <div class="flex items-center space-x-4 text-xs text-gray-500">
        <span>Built with ❤️ for the Ethereum community</span>
        <span>•</span>
        <span>Open Source</span>
        <span>•</span>
        <span>Decentralized</span>
      </div>
    </div>
  </div>
</footer>

<style>
  .gradient-text {
    background: linear-gradient(135deg, #ff4444, #8b5cf6, #fbbf24);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradientShift 3s ease infinite;
  }

  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>