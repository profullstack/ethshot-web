<script>
  import { GAME_CONFIG, formatTime as configFormatTime } from '../config.js';
</script>

<!-- Game Stats -->
<div class="grid grid-cols-3 gap-4 text-center">
  <div class="bg-gray-800/50 rounded-lg p-3">
    <div class="text-lg font-bold text-yellow-400">{GAME_CONFIG.WIN_PERCENTAGE}%</div>
    <div class="text-xs text-gray-400">Win Chance</div>
  </div>
  <div class="bg-gray-800/50 rounded-lg p-3">
    <div class="text-lg font-bold text-green-400">{GAME_CONFIG.WINNER_PERCENTAGE}%</div>
    <div class="text-xs text-gray-400">Winner Gets</div>
  </div>
  <div class="bg-gray-800/50 rounded-lg p-3">
    <div class="text-lg font-bold text-blue-400">{configFormatTime(GAME_CONFIG.COOLDOWN_SECONDS)}</div>
    <div class="text-xs text-gray-400">Cooldown</div>
  </div>
</div>