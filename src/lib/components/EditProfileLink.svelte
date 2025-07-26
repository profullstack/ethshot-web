<script>
	import { createEventDispatcher } from 'svelte';
	import { walletAddress } from '../stores/wallet.js';

	export let targetWalletAddress = null;
	export let className = '';
	export let showIcon = true;
	export let text = 'Edit Profile';

	const dispatch = createEventDispatcher();

	// Check if the logged-in user is viewing their own profile
	$: isOwnProfile = $walletAddress && targetWalletAddress && 
		$walletAddress.toLowerCase() === targetWalletAddress.toLowerCase();

	const handleClick = () => {
		if (!isOwnProfile) return;
		
		// Dispatch global event for opening profile modal
		const event = new CustomEvent('OpenProfileModal', {
			detail: {
				walletAddress: $walletAddress
			}
		});
		window.dispatchEvent(event);
		
		// Also dispatch local event for parent components
		dispatch('openProfile', {
			walletAddress: $walletAddress
		});
	};
</script>

{#if isOwnProfile}
	<button
		on:click={handleClick}
		class="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium {className}"
		title="Edit your profile"
	>
		{#if showIcon}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
			</svg>
		{/if}
		<span>{text}</span>
	</button>
{/if}