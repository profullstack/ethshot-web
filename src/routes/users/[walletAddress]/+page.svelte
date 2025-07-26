<script>
	import { page } from '$app/stores';
	import { formatAddress } from '$lib/database/index.js';
	import UserDisplay from '$lib/components/UserDisplay.svelte';
	import MetaTags from '$lib/components/MetaTags.svelte';
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
					<h1 class="text-3xl font-bold mb-2">{displayName}</h1>
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
						<p class="text-gray-300">{profile.bio}</p>
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