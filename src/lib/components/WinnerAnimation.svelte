<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let amount = '0';
  export let duration = 3000;
  
  const dispatch = createEventDispatcher();
  
  let animationContainer;
  let confettiElements = [];
  
  // Create confetti particles
  const createConfetti = () => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    const particles = [];
    
    for (let i = 0; i < 50; i++) {
      particles.push({
        id: i,
        color: colors[Math.floor(Math.random() * colors.length)],
        x: Math.random() * 100,
        y: -10,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.8 + 0.2,
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 3 + 2
        }
      });
    }
    
    return particles;
  };
  
  // Animate confetti particles
  const animateConfetti = () => {
    if (!show) return;
    
    confettiElements = confettiElements.map(particle => ({
      ...particle,
      x: particle.x + particle.velocity.x,
      y: particle.y + particle.velocity.y,
      rotation: particle.rotation + 5,
      velocity: {
        ...particle.velocity,
        y: particle.velocity.y + 0.1 // gravity
      }
    })).filter(particle => particle.y < 110); // Remove particles that fall off screen
    
    if (confettiElements.length > 0) {
      requestAnimationFrame(animateConfetti);
    }
  };
  
  // Start animation when show becomes true
  $: if (show) {
    confettiElements = createConfetti();
    animateConfetti();
    
    // Auto-hide after duration
    setTimeout(() => {
      dispatch('complete');
    }, duration);
  }
  
  onMount(() => {
    // Play celebration sound if available
    if (show && typeof Audio !== 'undefined') {
      try {
        // You can add a celebration sound file here
        // const audio = new Audio('/sounds/celebration.mp3');
        // audio.play().catch(() => {}); // Ignore if audio fails
      } catch (error) {
        // Ignore audio errors
      }
    }
  });
</script>

{#if show}
  <div 
    class="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
    bind:this={animationContainer}
  >
    <!-- Confetti particles -->
    {#each confettiElements as particle (particle.id)}
      <div
        class="absolute w-2 h-2 opacity-90"
        style="
          left: {particle.x}%;
          top: {particle.y}%;
          background-color: {particle.color};
          transform: rotate({particle.rotation}deg) scale({particle.scale});
          transition: none;
        "
      />
    {/each}
    
    <!-- Winner message -->
    <div class="winner-message animate-bounce">
      <div class="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white px-8 py-6 rounded-2xl shadow-2xl border-4 border-yellow-300">
        <div class="text-center">
          <div class="text-6xl mb-4">🎉</div>
          <h2 class="text-4xl font-bold mb-2 animate-pulse">JACKPOT!</h2>
          <p class="text-2xl font-semibold">You won {amount} ETH!</p>
          <div class="mt-4 text-lg opacity-90">
            Congratulations! 🎊
          </div>
        </div>
      </div>
    </div>
    
    <!-- Sparkle effects -->
    <div class="sparkles">
      {#each Array(20) as _, i}
        <div 
          class="sparkle sparkle-{i}"
          style="
            left: {Math.random() * 100}%;
            top: {Math.random() * 100}%;
            animation-delay: {Math.random() * 2}s;
          "
        >
          ✨
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .winner-message {
    animation: winnerPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  @keyframes winnerPop {
    0% {
      transform: scale(0) rotate(-180deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.1) rotate(-90deg);
      opacity: 0.8;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  
  .sparkle {
    position: absolute;
    font-size: 1.5rem;
    animation: sparkleFloat 3s infinite ease-in-out;
    pointer-events: none;
  }
  
  @keyframes sparkleFloat {
    0%, 100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0;
    }
    50% {
      transform: translateY(-20px) rotate(180deg);
      opacity: 1;
    }
  }
  
  /* Individual sparkle delays */
  .sparkle-0 { animation-delay: 0s; }
  .sparkle-1 { animation-delay: 0.1s; }
  .sparkle-2 { animation-delay: 0.2s; }
  .sparkle-3 { animation-delay: 0.3s; }
  .sparkle-4 { animation-delay: 0.4s; }
  .sparkle-5 { animation-delay: 0.5s; }
  .sparkle-6 { animation-delay: 0.6s; }
  .sparkle-7 { animation-delay: 0.7s; }
  .sparkle-8 { animation-delay: 0.8s; }
  .sparkle-9 { animation-delay: 0.9s; }
  .sparkle-10 { animation-delay: 1s; }
  .sparkle-11 { animation-delay: 1.1s; }
  .sparkle-12 { animation-delay: 1.2s; }
  .sparkle-13 { animation-delay: 1.3s; }
  .sparkle-14 { animation-delay: 1.4s; }
  .sparkle-15 { animation-delay: 1.5s; }
  .sparkle-16 { animation-delay: 1.6s; }
  .sparkle-17 { animation-delay: 1.7s; }
  .sparkle-18 { animation-delay: 1.8s; }
  .sparkle-19 { animation-delay: 1.9s; }
</style>