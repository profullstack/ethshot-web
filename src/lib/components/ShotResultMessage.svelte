<script>
  import { createEventDispatcher } from 'svelte';
  import { formatEther } from '$lib/database/index.js';

  export let show = false;
  export let result = null; // { won: boolean, amount?: string, shotCost: string }
  
  const dispatch = createEventDispatcher();
  
  let animationClass = '';
  
  $: if (show && result) {
    animationClass = result.won ? 'animate-win' : 'animate-loss';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      handleClose();
    }, 5000);
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
  
  // Win messages - enthusiastic and celebratory
  const winMessages = [
    "🎉 JACKPOT! YOU WON! 🎉",
    "💰 WINNER WINNER! 💰",
    "🚀 TO THE MOON! YOU WON! 🚀",
    "⚡ LIGHTNING STRIKES! YOU'RE RICH! ⚡",
    "🏆 CHAMPION! YOU DID IT! 🏆",
    "💎 DIAMOND HANDS PAID OFF! 💎",
    "🎊 CELEBRATION TIME! YOU WON! 🎊",
    "🔥 ON FIRE! JACKPOT HIT! 🔥"
  ];
  
  // Loss messages - disappointing but encouraging
  const lossMessages = [
    "💥 Shot Missed... Better Luck Next Time!",
    "😔 No Luck This Round... Try Again!",
    "🎯 Close But No Cigar... Keep Shooting!",
    "💔 Not This Time... Fortune Awaits!",
    "🌙 The Stars Weren't Aligned... Yet!",
    "⚡ Lightning Didn't Strike... This Time!",
    "🎲 The Dice Didn't Roll Your Way...",
    "🍀 Luck Will Find You... Keep Trying!"
  ];
  
  $: randomWinMessage = winMessages[Math.floor(Math.random() * winMessages.length)];
  $: randomLossMessage = lossMessages[Math.floor(Math.random() * lossMessages.length)];
</script>

{#if show && result}
  <!-- Full-screen overlay -->
  <div class="shot-result-overlay" class:show>
    <div class="shot-result-container {animationClass}">
      {#if result.won}
        <!-- WIN MESSAGE -->
        <div class="win-message">
          <div class="win-header">
            <h1 class="win-title">{randomWinMessage}</h1>
            <div class="win-amount">
              <span class="amount-label">You Won:</span>
              <span class="amount-value">{formatEther(result.amount)} ETH</span>
            </div>
          </div>
          
          <div class="win-details">
            <p class="win-subtitle">🎊 Congratulations! The ETH is yours! 🎊</p>
            <div class="win-stats">
              <div class="stat">
                <span class="stat-label">Shot Cost:</span>
                <span class="stat-value">{formatEther(result.shotCost)} ETH</span>
              </div>
              <div class="stat profit">
                <span class="stat-label">Your Profit:</span>
                <span class="stat-value">+{formatEther((parseFloat(result.amount) - parseFloat(result.shotCost)).toString())} ETH</span>
              </div>
            </div>
          </div>
          
          <button class="close-button win-button" on:click={handleClose}>
            🎉 Awesome! 🎉
          </button>
        </div>
      {:else}
        <!-- LOSS MESSAGE -->
        <div class="loss-message">
          <div class="loss-header">
            <h1 class="loss-title">{randomLossMessage}</h1>
            <div class="loss-amount">
              <span class="amount-label">Shot Cost:</span>
              <span class="amount-value">{formatEther(result.shotCost)} ETH</span>
            </div>
          </div>
          
          <div class="loss-details">
            <p class="loss-subtitle">Don't give up! The next shot could be THE ONE! 🎯</p>
            <div class="encouragement">
              <p>💪 Every shot brings you closer to victory!</p>
              <p>🍀 Fortune favors the persistent!</p>
            </div>
          </div>
          
          <button class="close-button loss-button" on:click={handleClose}>
            Try Again! 🚀
          </button>
        </div>
      {/if}
      
      <!-- Close X button -->
      <button class="close-x" on:click={handleClose}>✕</button>
    </div>
  </div>
{/if}

<style>
  .shot-result-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }
  
  .shot-result-overlay.show {
    opacity: 1;
    visibility: visible;
  }
  
  .shot-result-container {
    max-width: 600px;
    width: 90%;
    position: relative;
    transform: scale(0.8);
    transition: transform 0.3s ease;
  }
  
  .shot-result-overlay.show .shot-result-container {
    transform: scale(1);
  }
  
  /* WIN STYLES */
  .win-message {
    background: linear-gradient(135deg, #ffd700, #ffed4e, #ffd700);
    border: 3px solid #ffd700;
    border-radius: 20px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
    animation: winPulse 2s ease-in-out infinite;
  }
  
  .win-title {
    font-size: 2.5rem;
    font-weight: 900;
    color: #1a1a1a;
    margin-bottom: 1rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    animation: winShake 0.5s ease-in-out;
  }
  
  .win-amount {
    margin-bottom: 1.5rem;
  }
  
  .win-amount .amount-label {
    display: block;
    font-size: 1.2rem;
    color: #1a1a1a;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .win-amount .amount-value {
    display: block;
    font-size: 3rem;
    font-weight: 900;
    color: #1a1a1a;
    font-family: 'Courier New', monospace;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .win-subtitle {
    font-size: 1.3rem;
    color: #1a1a1a;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }
  
  .win-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  
  .stat {
    text-align: center;
  }
  
  .stat-label {
    display: block;
    font-size: 0.9rem;
    color: #1a1a1a;
    opacity: 0.8;
    margin-bottom: 0.25rem;
  }
  
  .stat-value {
    display: block;
    font-size: 1.2rem;
    font-weight: 700;
    color: #1a1a1a;
    font-family: 'Courier New', monospace;
  }
  
  .stat.profit .stat-value {
    color: #059669;
  }
  
  .win-button {
    background: linear-gradient(135deg, #059669, #10b981);
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.2rem;
    font-weight: 700;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);
  }
  
  .win-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(5, 150, 105, 0.6);
  }
  
  /* LOSS STYLES */
  .loss-message {
    background: linear-gradient(135deg, #374151, #4b5563, #374151);
    border: 3px solid #6b7280;
    border-radius: 20px;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 0 30px rgba(107, 114, 128, 0.3);
  }
  
  .loss-title {
    font-size: 2rem;
    font-weight: 900;
    color: #f87171;
    margin-bottom: 1rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }
  
  .loss-amount {
    margin-bottom: 1.5rem;
  }
  
  .loss-amount .amount-label {
    display: block;
    font-size: 1rem;
    color: #d1d5db;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .loss-amount .amount-value {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: #f87171;
    font-family: 'Courier New', monospace;
  }
  
  .loss-subtitle {
    font-size: 1.1rem;
    color: #d1d5db;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }
  
  .encouragement {
    margin-bottom: 2rem;
  }
  
  .encouragement p {
    font-size: 1rem;
    color: #9ca3af;
    margin-bottom: 0.5rem;
  }
  
  .loss-button {
    background: linear-gradient(135deg, #dc2626, #ef4444);
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: 700;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4);
  }
  
  .loss-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.6);
  }
  
  /* CLOSE BUTTON */
  .close-x {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .close-x:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }
  
  /* ANIMATIONS */
  @keyframes winPulse {
    0%, 100% {
      box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
    }
    50% {
      box-shadow: 0 0 80px rgba(255, 215, 0, 0.8);
    }
  }
  
  @keyframes winShake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .animate-win {
    animation: winEntrance 0.6s ease-out;
  }
  
  .animate-loss {
    animation: lossEntrance 0.4s ease-out;
  }
  
  @keyframes winEntrance {
    0% {
      transform: scale(0.5) rotate(-10deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.1) rotate(5deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  
  @keyframes lossEntrance {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* RESPONSIVE */
  @media (max-width: 640px) {
    .win-title, .loss-title {
      font-size: 1.8rem;
    }
    
    .win-amount .amount-value {
      font-size: 2rem;
    }
    
    .win-stats {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .shot-result-container {
      width: 95%;
    }
  }
</style>