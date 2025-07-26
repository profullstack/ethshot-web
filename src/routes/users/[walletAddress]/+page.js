import { error } from '@sveltejs/kit';
import { db } from '$lib/database/index.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
	const { walletAddress } = params;
	
	// Validate wallet address format (basic validation)
	if (!walletAddress || walletAddress.length < 10) {
		throw error(400, 'Invalid wallet address');
	}

	try {
		// Get player data to check if user exists
		const playerData = await db.getPlayer(walletAddress);
		
		if (!playerData) {
			throw error(404, 'User not found');
		}

		// Get user profile information
		const userProfile = await db.getUserProfile(walletAddress);

		// Get referral stats
		const referralStats = await db.getReferralStats(walletAddress);

		// Get recent winners to see if this user has won
		const recentWinners = await db.getRecentWinners(50);
		const userWins = recentWinners.filter(winner =>
			winner.winner_address?.toLowerCase() === walletAddress.toLowerCase()
		);

		// Get recent shots (using a basic query since we don't have the RPC function)
		const recentShots = await db.getRecentShots(50);
		const userShots = recentShots.filter(shot =>
			shot.player_address?.toLowerCase() === walletAddress.toLowerCase()
		).slice(0, 10);

		// Get user discounts
		const availableDiscounts = await db.getUserDiscounts(walletAddress);

		// Calculate win rate
		const totalShots = playerData.total_shots || 0;
		const winCount = userWins.length;
		const winRate = totalShots > 0 ? Math.round((winCount / totalShots) * 100) : 0;

		// Calculate biggest win
		const biggestWin = userWins.length > 0
			? Math.max(...userWins.map(win => parseFloat(win.amount || '0')))
			: 0;

		// Calculate ROI
		const totalSpent = parseFloat(playerData.total_spent || '0');
		const totalWon = parseFloat(playerData.total_won || '0');
		const roi = totalSpent > 0 ? Math.round(((totalWon - totalSpent) / totalSpent) * 100) : 0;

		// Create user statistics object with the structure the component expects
		const userStats = {
			wallet_address: walletAddress.toLowerCase(),
			
			// Profile information (for UserDisplay component and header)
			profile: {
				nickname: userProfile?.nickname || null,
				avatar_url: userProfile?.avatar_url || null,
				bio: userProfile?.bio || null,
				created_at: userProfile?.created_at || playerData.created_at,
				updated_at: userProfile?.updated_at || playerData.updated_at
			},
			
			// Game statistics (for the stats cards)
			game_stats: {
				total_shots: totalShots,
				total_spent: playerData.total_spent || '0',
				total_won: playerData.total_won || '0',
				win_rate: winRate,
				biggest_win: biggestWin.toString(),
				roi_percentage: roi,
				current_win_streak: 0, // We don't have streak data yet
				last_shot_time: playerData.last_shot_time,
				shots_rank: 0, // We don't have ranking data yet
				winnings_rank: 0 // We don't have ranking data yet
			},
			
			// Referral statistics
			referral_stats: referralStats ? {
				total_referrals: referralStats.total_referrals || 0,
				successful_referrals: referralStats.successful_referrals || 0,
				total_bonus_shots_earned: referralStats.total_bonus_shots_earned || 0,
				referral_code: referralStats.referral_code || null,
				referred_by: referralStats.referred_by || null
			} : {
				total_referrals: 0,
				successful_referrals: 0,
				total_bonus_shots_earned: 0,
				referral_code: null,
				referred_by: null
			},
			
			// Achievements (basic set)
			achievements: {
				first_shot: totalShots > 0,
				big_spender: totalSpent > 0.1,
				winner: winCount > 0,
				referrer: referralStats?.total_referrals > 0,
				veteran: totalShots > 10
			},
			
			// Recent activity (from shots and wins)
			recent_activity: [
				...userShots.map(shot => ({
					type: 'shot',
					amount: shot.amount,
					won: shot.won,
					timestamp: shot.timestamp,
					tx_hash: shot.tx_hash
				})),
				...userWins.map(win => ({
					type: 'win',
					amount: win.amount,
					won: true,
					timestamp: win.timestamp,
					tx_hash: win.tx_hash
				}))
			].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)
		};

		return {
			walletAddress,
			userStats,
			referrals: referralStats ? {
				referrals: [], // We don't have individual referral data yet
				total_count: referralStats.total_referrals || 0
			} : { referrals: [], total_count: 0 },
			wins: { wins: userWins },
			recentShots: userShots,
			availableDiscounts,
			userProfile
		};
	} catch (err) {
		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Unexpected error in user profile load:', err);
		throw error(500, 'An unexpected error occurred');
	}
}