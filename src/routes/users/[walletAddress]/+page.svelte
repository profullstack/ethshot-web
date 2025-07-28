<script>
	import { page } from '$app/stores';
	import { formatAddress } from '$lib/database/index.js';
	import UserDisplay from '$lib/components/UserDisplay.svelte';
	import MetaTags from '$lib/components/MetaTags.svelte';
	import EditProfileLink from '$lib/components/EditProfileLink.svelte';
	import { NETWORK_CONFIG } from '$lib/config.js';

	/** @type {import('./$types').PageData} */
	export let data;

	$: ({ walletAddress, userStats, referrals, wins, recentShots } = data);
	$: profile = userStats?.profile;
	$: gameStats = userStats?.game_stats;
	$: referralStats = userStats?.referral_stats;
	$: achievements = userStats?.achievements;
	$: recentActivity = userStats?.recent_activity || [];

	// Copy functionality
	let copySuccess = false;
	let copyTimeout;

	async function copyWalletAddress() {
		try {
			await navigator.clipboard.writeText(walletAddress);
			copySuccess = true;
			
			// Clear any existing timeout
			if (copyTimeout) {
				clearTimeout(copyTimeout);
			}
			
			// Reset the success state after 2 seconds
			copyTimeout = setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy wallet address:', error);
			// Fallback for older browsers
			try {
				const textArea = document.createElement('textarea');
				textArea.value = walletAddress;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				copySuccess = true;
				
				copyTimeout = setTimeout(() => {
					copySuccess = false;
				}, 2000);
			} catch (fallbackError) {
				console.error('Fallback copy failed:', fallbackError);
			}
		}
	}

	// Helper functions
	function formatEth(amount) {
		if (!amount || amount === '0') return '0';
		const num = parseFloat(amount);
		if (num < 0.001) return num.toFixed(6);
		if (num < 1) return num.toFixed(4);
		return num.toFixed(3);
	}

	function formatDate(dateString) {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getActivityIcon(type) {
		switch (type) {
			case 'shot':
				return '🎯';
			case 'win':
				return '🏆';
			default:
				return '📊';
		}
	}

	function getAchievementIcon(achievement) {
		switch (achievement) {
			case 'first_shot':
				return '🎯';
			case 'big_spender':
				return '💰';
			case 'winner':
				return '🏆';
			case 'referrer':
				return '👥';
			case 'veteran':
				return '⭐';
			default:
				return '🏅';
		}
	}

	function getAchievementTitle(achievement) {
		switch (achievement) {
			case 'first_shot':
				return 'First Shot';
			case 'big_spender':
				return 'Big Spender';
			case 'winner':
				return 'Winner';
			case 'referrer':
				return 'Referrer';
			case 'veteran':
				return 'Veteran';
			default:
				return 'Achievement';
		}
	}

	$: displayName = profile?.nickname || formatAddress(walletAddress);
	$: pageTitle = `${displayName} - User Profile`;
</script>

<MetaTags
	title={pageTitle}
	description="View {displayName}'s game statistics, referrals, and achievements on EthShot"
	canonical="{$page.url.origin}/users/{walletAddress}"
/>

<div class="min-h-screen bg-gray-900 text-white">
	<div class="container mx-auto px-4 py-8">
		<!-- Profile Header -->
		<div class="bg-gray-800 rounded-lg p-6 mb-8">
			<div class="flex flex-col md:flex-row items-start md:items-center gap-6">
				<div class="flex items-center gap-4">
					<UserDisplay
						{walletAddress}
						{profile}
						size="lg"
						showAddress={false}
						className="text-xl"
					/>
				</div>
				
				<div class="flex-1">
					<div class="flex items-start justify-between mb-2">
						<h1 class="text-3xl font-bold">{displayName}</h1>
						<EditProfileLink targetWalletAddress={walletAddress} />
					</div>
					<div class="flex items-center gap-2 mb-2">
						<p class="text-gray-400 font-mono text-sm">{formatAddress(walletAddress)}</p>
						<button
							on:click={copyWalletAddress}
							class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded transition-colors duration-200"
							title="Copy full wallet address"
						>
							{#if copySuccess}
								<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
								</svg>
								<span>Copied!</span>
							{:else}
								<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
									<path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
									<path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
								</svg>
								<span>Copy</span>
							{/if}
						</button>
					</div>
					{#if profile?.bio}
						<p class="text-gray-300 mb-3">{profile.bio}</p>
					{/if}
					
					<!-- Social Media Links -->
					{#if profile?.twitter_handle || profile?.discord_handle || profile?.website_url}
						<div class="flex items-center gap-3 mb-3">
							{#if profile?.twitter_handle}
								<a
									href="https://twitter.com/{profile.twitter_handle}"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
									title="Follow on Twitter"
								>
									<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
										<path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
									</svg>
									@{profile.twitter_handle}
								</a>
							{/if}
							
							{#if profile?.discord_handle}
								<span
									class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded text-xs"
									title="Discord Handle"
								>
									<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
										<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
									</svg>
									{profile.discord_handle}
								</span>
							{/if}
							
							{#if profile?.website_url}
								<a
									href={profile.website_url}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
									title="Visit Website"
								>
									<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
									</svg>
									Website
								</a>
							{/if}
						</div>
					{/if}
					
					<p class="text-xs text-gray-500 mt-2">
						Member since {formatDate(profile?.created_at || gameStats?.last_shot_time)}
					</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Main Stats Column -->
			<div class="lg:col-span-2 space-y-8">
				<!-- Game Statistics -->
				<div class="bg-gray-800 rounded-lg p-6">
					<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
						🎮 Game Statistics
					</h2>
					
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-blue-400">{gameStats?.total_shots || 0}</div>
							<div class="text-sm text-gray-400">Total Shots</div>
							{#if gameStats?.shots_rank > 0}
								<div class="text-xs text-yellow-400">#{gameStats.shots_rank}</div>
							{/if}
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-green-400">{formatEth(gameStats?.total_won)} ETH</div>
							<div class="text-sm text-gray-400">Total Won</div>
							{#if gameStats?.winnings_rank > 0}
								<div class="text-xs text-yellow-400">#{gameStats.winnings_rank}</div>
							{/if}
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-red-400">{formatEth(gameStats?.total_spent)} ETH</div>
							<div class="text-sm text-gray-400">Total Spent</div>
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-purple-400">{gameStats?.win_rate || 0}%</div>
							<div class="text-sm text-gray-400">Win Rate</div>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-lg font-bold text-yellow-400">{formatEth(gameStats?.biggest_win)} ETH</div>
							<div class="text-sm text-gray-400">Biggest Win</div>
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-lg font-bold text-orange-400">{gameStats?.roi_percentage || 0}%</div>
							<div class="text-sm text-gray-400">ROI</div>
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4 text-center">
							<div class="text-lg font-bold text-cyan-400">{gameStats?.current_win_streak || 0}</div>
							<div class="text-sm text-gray-400">Win Streak</div>
						</div>
					</div>
				</div>

				<!-- Recent Activity -->
				<div class="bg-gray-800 rounded-lg p-6">
					<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
						📈 Recent Activity
					</h2>
					
					{#if recentActivity.length > 0}
						<div class="space-y-3">
							{#each recentActivity as activity}
								<div class="flex items-center justify-between bg-gray-700 rounded-lg p-3">
									<div class="flex items-center gap-3">
										<span class="text-xl">{getActivityIcon(activity.type)}</span>
										<div>
											<div class="font-medium">
												{activity.type === 'shot' ? 'Shot Taken' : 'Jackpot Won'}
											</div>
											<div class="text-sm text-gray-400">
												{formatDate(activity.timestamp)}
											</div>
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold {activity.won ? 'text-green-400' : 'text-red-400'}">
											{activity.won ? '+' : '-'}{formatEth(activity.amount)} ETH
										</div>
										{#if activity.tx_hash}
											<a
												href="{NETWORK_CONFIG.BLOCK_EXPLORER_URL}/tx/{activity.tx_hash}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-xs text-blue-400 hover:text-blue-300"
											>
												View TX
											</a>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-gray-400 text-center py-8">No recent activity</p>
					{/if}
				</div>

				<!-- Wins History -->
				{#if wins?.wins?.length > 0}
					<div class="bg-gray-800 rounded-lg p-6">
						<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
							🏆 Wins History
						</h2>
						
						<div class="space-y-3">
							{#each wins.wins as win}
								<div class="flex items-center justify-between bg-gray-700 rounded-lg p-3">
									<div class="flex items-center gap-3">
										<span class="text-xl">🏆</span>
										<div>
											<div class="font-medium">Jackpot Won</div>
											<div class="text-sm text-gray-400">
												{formatDate(win.timestamp)}
											</div>
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-green-400">
											+{formatEth(win.amount)} ETH
										</div>
										{#if win.tx_hash}
											<a
												href="{NETWORK_CONFIG.BLOCK_EXPLORER_URL}/tx/{win.tx_hash}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-xs text-blue-400 hover:text-blue-300"
											>
												View TX
											</a>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-8">
				<!-- Achievements -->
				<div class="bg-gray-800 rounded-lg p-6">
					<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
						🏅 Achievements
					</h2>
					
					<div class="grid grid-cols-2 gap-3">
						{#each Object.entries(achievements || {}) as [key, earned]}
							<div class="bg-gray-700 rounded-lg p-3 text-center {earned ? 'opacity-100' : 'opacity-50'}">
								<div class="text-2xl mb-1">{getAchievementIcon(key)}</div>
								<div class="text-xs font-medium">{getAchievementTitle(key)}</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Referral Stats -->
				<div class="bg-gray-800 rounded-lg p-6">
					<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
						👥 Referral Stats
					</h2>
					
					<div class="space-y-4">
						<div class="bg-gray-700 rounded-lg p-4">
							<div class="text-2xl font-bold text-blue-400 text-center">
								{referralStats?.total_referrals || 0}
							</div>
							<div class="text-sm text-gray-400 text-center">Total Referrals</div>
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4">
							<div class="text-2xl font-bold text-green-400 text-center">
								{referralStats?.successful_referrals || 0}
							</div>
							<div class="text-sm text-gray-400 text-center">Active Referrals</div>
						</div>
						
						<div class="bg-gray-700 rounded-lg p-4">
							<div class="text-2xl font-bold text-purple-400 text-center">
								{referralStats?.total_bonus_shots_earned || 0}
							</div>
							<div class="text-sm text-gray-400 text-center">Bonus Shots Earned</div>
						</div>

						{#if referralStats?.referral_code}
							<div class="bg-gray-700 rounded-lg p-4">
								<div class="text-sm text-gray-400 text-center mb-2">Referral Code</div>
								<div class="font-mono text-center bg-gray-600 rounded px-2 py-1">
									{referralStats.referral_code}
								</div>
							</div>
						{/if}

						{#if referralStats?.referred_by}
							<div class="bg-gray-700 rounded-lg p-4">
								<div class="text-sm text-gray-400 text-center mb-2">Referred By</div>
								<div class="text-center">
									<a 
										href="/users/{referralStats.referred_by}"
										class="text-blue-400 hover:text-blue-300 font-mono text-sm"
									>
										{formatAddress(referralStats.referred_by)}
									</a>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Referrals List -->
				{#if referrals?.referrals?.length > 0}
					<div class="bg-gray-800 rounded-lg p-6">
						<h2 class="text-xl font-bold mb-4 flex items-center gap-2">
							👥 Referrals ({referrals.total_count})
						</h2>
						
						<div class="space-y-3 max-h-96 overflow-y-auto">
							{#each referrals.referrals as referral}
								<div class="bg-gray-700 rounded-lg p-3">
									<div class="flex items-center justify-between">
										<a 
											href="/users/{referral.referee_address}"
											class="flex items-center gap-2 hover:text-blue-400"
										>
											<UserDisplay
												walletAddress={referral.referee_address}
												profile={referral.referee_profile}
												size="sm"
												showAddress={false}
											/>
										</a>
										<div class="text-xs {referral.is_active ? 'text-green-400' : 'text-gray-400'}">
											{referral.is_active ? 'Active' : 'Pending'}
										</div>
									</div>
									<div class="text-xs text-gray-400 mt-1">
										Joined {formatDate(referral.created_at)}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
	}
</style>