<script>
  import { currentSponsor } from '../stores/game-unified.js';
  import { GAME_CONFIG, formatEth } from '../config.js';

  // Use real sponsor data from store
  $: sponsor = $currentSponsor;
  
  // Debug sponsor data
  $: if (sponsor) {
    console.log('🎪 Sponsor data:', {
      sponsor,
      hasLogoUrl: !!sponsor.logoUrl,
      hasLogo_url: !!sponsor.logo_url,
      hasSponsorUrl: !!sponsor.sponsor_url,
      logoUrlValue: sponsor.logoUrl || sponsor.logo_url,
      sponsorUrlValue: sponsor.sponsor_url
    });
  }

  // Format time remaining for sponsorship
  const timeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
  };
</script>

{#if sponsor && sponsor.active}
  <!-- Active Sponsor Banner -->
  <div class="sponsor-banner">
    <div class="sponsor-content">
      <!-- Sponsor Badge -->
      <div class="sponsor-badge">
        <span class="badge-text">SPONSORED</span>
      </div>

      <!-- Sponsor Info -->
      <div class="sponsor-info">
        {#if sponsor.sponsor_url}
          <!-- Clickable sponsor with URL -->
          <a
            href={sponsor.sponsor_url}
            target="_blank"
            rel="noopener noreferrer"
            class="sponsor-link"
            title="Visit {sponsor.name}"
          >
            <div class="sponsor-content-wrapper">
              {#if sponsor.logoUrl || sponsor.logo_url}
                <img
                  src={sponsor.logoUrl || sponsor.logo_url}
                  alt="{sponsor.name} logo"
                  class="sponsor-logo clickable"
                  on:error={(e) => e.target.style.display = 'none'}
                />
              {/if}
              
              <div class="sponsor-details">
                <h4 class="sponsor-name clickable">{sponsor.name}</h4>
                <p class="sponsor-tagline">Sponsoring this round • Click to visit</p>
              </div>
            </div>
          </a>
        {:else}
          <!-- Non-clickable sponsor without URL -->
          <div class="sponsor-content-wrapper">
            {#if sponsor.logoUrl || sponsor.logo_url}
              <img
                src={sponsor.logoUrl || sponsor.logo_url}
                alt="{sponsor.name} logo"
                class="sponsor-logo"
                on:error={(e) => e.target.style.display = 'none'}
              />
            {/if}
            
            <div class="sponsor-details">
              <h4 class="sponsor-name">{sponsor.name}</h4>
              <p class="sponsor-tagline">Sponsoring this round</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sponsor Meta -->
      <div class="sponsor-meta">
        <span class="sponsor-time">
          Sponsored {timeAgo(sponsor.timestamp)}
        </span>
      </div>
    </div>

    <!-- Sponsor Effects -->
    <div class="sponsor-effects">
      <div class="sparkle sparkle-1">✨</div>
      <div class="sparkle sparkle-2">⭐</div>
      <div class="sparkle sparkle-3">💫</div>
    </div>
  </div>
{:else}
  <!-- No Sponsor / Sponsor Opportunity -->
  <div class="sponsor-opportunity">
    <div class="opportunity-content">
      <div class="opportunity-icon">
        🎪
      </div>
      <div class="opportunity-text">
        <h4 class="opportunity-title">Sponsor This Round</h4>
        <p class="opportunity-description">
          Get your brand seen by thousands of players for just {formatEth(GAME_CONFIG.SPONSOR_COST_ETH)} ETH
        </p>
      </div>
      <a 
        href="/sponsor" 
        class="sponsor-cta"
      >
        Become a Sponsor
      </a>
    </div>
  </div>
{/if}

<style>
  .sponsor-banner {
    @apply relative bg-gradient-to-r from-purple-600/20 to-pink-600/20;
    @apply backdrop-blur-sm rounded-xl border border-purple-500/30;
    @apply p-6 mb-6 overflow-hidden;
    animation: sponsorGlow 3s ease-in-out infinite;
  }

  .sponsor-content {
    @apply relative z-10 flex items-center justify-between;
  }

  .sponsor-badge {
    @apply absolute -top-2 -left-2 bg-gradient-to-r from-purple-500 to-pink-500;
    @apply text-white text-xs font-bold px-3 py-1 rounded-full;
    @apply shadow-lg transform -rotate-12;
  }

  .badge-text {
    @apply tracking-wider;
  }

  .sponsor-info {
    @apply flex items-center flex-1;
  }

  .sponsor-link {
    @apply flex items-center flex-1;
    @apply transition-all duration-200 rounded-lg p-2 -m-2;
    @apply hover:bg-white/10 hover:backdrop-blur-sm;
    @apply focus:outline-none focus:ring-2 focus:ring-purple-400/50;
    text-decoration: none;
  }

  .sponsor-content-wrapper {
    @apply flex items-center justify-center space-x-4 flex-1;
  }

  .sponsor-logo {
    @apply w-12 h-12 rounded-lg object-contain;
    @apply border-2 border-white/20 shadow-lg;
    @apply transition-transform duration-200;
  }

  .sponsor-logo.clickable {
    @apply hover:scale-105 hover:border-purple-300/50;
  }

  .sponsor-details {
    @apply text-center;
  }

  .sponsor-name {
    @apply text-xl font-bold text-white;
    @apply transition-colors duration-200;
  }

  .sponsor-name.clickable {
    @apply hover:text-purple-200;
  }

  .sponsor-tagline {
    @apply text-sm text-purple-200;
  }

  .sponsor-meta {
    @apply text-right;
  }

  .sponsor-time {
    @apply text-xs text-purple-300;
  }

  .sponsor-effects {
    @apply absolute inset-0 pointer-events-none;
  }

  .sparkle {
    @apply absolute text-lg;
    animation: sparkleFloat 2s ease-in-out infinite;
  }

  .sparkle-1 {
    @apply top-2 left-8;
    animation-delay: 0s;
  }

  .sparkle-2 {
    @apply top-4 right-12;
    animation-delay: 0.7s;
  }

  .sparkle-3 {
    @apply bottom-2 left-16;
    animation-delay: 1.4s;
  }

  .sponsor-opportunity {
    @apply bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-600;
    @apply p-4 mb-6 text-center;
  }

  .opportunity-content {
    @apply flex items-center justify-between space-x-4;
  }

  .opportunity-icon {
    @apply text-3xl;
  }

  .opportunity-text {
    @apply flex-1 text-left;
  }

  .opportunity-title {
    @apply text-lg font-semibold text-white;
  }

  .opportunity-description {
    @apply text-sm text-gray-400 mt-1;
  }

  .sponsor-cta {
    @apply bg-gradient-to-r from-purple-500 to-pink-500;
    @apply hover:from-purple-400 hover:to-pink-400;
    @apply text-white font-semibold px-6 py-2 rounded-lg;
    @apply transition-all duration-200 transform hover:scale-105;
    @apply focus:outline-none focus:ring-4 focus:ring-purple-500/50;
  }

  /* Animations */
  @keyframes sponsorGlow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
    }
    50% {
      box-shadow: 0 0 30px rgba(168, 85, 247, 0.5);
    }
  }

  @keyframes sparkleFloat {
    0%, 100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0.7;
    }
    50% {
      transform: translateY(-10px) rotate(180deg);
      opacity: 1;
    }
  }

  /* Mobile Responsive */
  @media (max-width: 640px) {
    .sponsor-banner {
      @apply p-4;
    }

    .sponsor-content {
      @apply flex-col space-y-4;
    }

    .sponsor-info {
      @apply justify-center text-center;
    }

    .sponsor-meta {
      @apply text-center;
    }

    .opportunity-content {
      @apply flex-col space-y-3 space-x-0;
    }

    .opportunity-text {
      @apply text-center;
    }
  }
</style>