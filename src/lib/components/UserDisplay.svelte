<script>
  import { formatAddress } from '../supabase.js';

  // Props
  export let walletAddress = '';
  export let profile = null;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let showAddress = true;
  export let showAvatar = true;
  export let className = '';
  export let linkToProfile = true; // New prop to control linking

  // Reactive statements
  $: displayName = profile?.nickname || formatAddress(walletAddress);
  $: avatarUrl = profile?.avatar_url;
  $: profileUrl = `/users/${walletAddress}`;
  
  // Size configurations
  $: sizeClasses = {
    sm: {
      avatar: 'w-6 h-6',
      text: 'text-xs',
      container: 'space-x-1'
    },
    md: {
      avatar: 'w-8 h-8',
      text: 'text-sm',
      container: 'space-x-2'
    },
    lg: {
      avatar: 'w-12 h-12',
      text: 'text-base',
      container: 'space-x-3'
    }
  }[size];

  // Generate initials from wallet address if no avatar
  $: initials = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '??';
</script>

<svelte:element 
  this={linkToProfile && walletAddress ? 'a' : 'div'}
  href={linkToProfile && walletAddress ? profileUrl : undefined}
  class="user-display flex items-center {sizeClasses.container} {className} {linkToProfile && walletAddress ? 'interactive hover:bg-gray-700/30 transition-colors rounded-lg p-1 -m-1 cursor-pointer' : ''}"
>
  {#if showAvatar}
    <div class="user-avatar {sizeClasses.avatar} rounded-full overflow-hidden flex-shrink-0">
      {#if avatarUrl}
        <img 
          src={avatarUrl} 
          alt="{displayName} avatar"
          class="w-full h-full object-cover"
          loading="lazy"
        />
      {:else}
        <div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span class="text-white font-bold text-xs">{initials}</span>
        </div>
      {/if}
    </div>
  {/if}

  <div class="user-info flex-1 min-w-0">
    <div class="user-name {sizeClasses.text} font-medium text-white truncate">
      {displayName}
    </div>
    
    {#if showAddress && profile?.nickname}
      <div class="user-address text-xs text-gray-400 font-mono truncate">
        {formatAddress(walletAddress)}
      </div>
    {/if}
  </div>
</svelte:element>

<style>
  .user-display {
    @apply max-w-full;
  }

  .user-avatar {
    @apply border border-gray-600;
  }

  .user-info {
    @apply overflow-hidden;
  }

  /* Special styling for current user */
  .user-display.current-user .user-name {
    @apply text-blue-400;
  }

  .user-display.current-user .user-avatar {
    @apply border-blue-500;
  }
</style>