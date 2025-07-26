import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
	const { walletAddress } = params;
	
	// Validate wallet address format (basic validation)
	if (!walletAddress || walletAddress.length < 10) {
		throw error(400, 'Invalid wallet address');
	}

	try {
		// Check if user exists first
		const { data: userExists, error: existsError } = await supabase
			.rpc('user_exists', { wallet_addr: walletAddress });

		if (existsError) {
			console.error('Error checking user existence:', existsError);
			throw error(500, 'Failed to check user existence');
		}

		if (!userExists) {
			throw error(404, 'User not found');
		}

		// Get comprehensive user statistics
		const { data: userStats, error: statsError } = await supabase
			.rpc('get_user_statistics', { wallet_addr: walletAddress });

		if (statsError) {
			console.error('Error fetching user statistics:', statsError);
			throw error(500, 'Failed to load user statistics');
		}

		// Get user referrals
		const { data: referralsData, error: referralsError } = await supabase
			.rpc('get_user_referrals', { wallet_addr: walletAddress });

		if (referralsError) {
			console.error('Error fetching user referrals:', referralsError);
			throw error(500, 'Failed to load user referrals');
		}

		// Get user wins history
		const { data: winsData, error: winsError } = await supabase
			.rpc('get_user_wins_history', { wallet_addr: walletAddress });

		if (winsError) {
			console.error('Error fetching user wins:', winsError);
			throw error(500, 'Failed to load user wins');
		}

		// Get recent shot history (first page)
		const { data: shotsData, error: shotsError } = await supabase
			.rpc('get_user_shot_history', { 
				wallet_addr: walletAddress,
				page_limit: 10,
				page_offset: 0
			});

		if (shotsError) {
			console.error('Error fetching user shots:', shotsError);
			throw error(500, 'Failed to load user shots');
		}

		return {
			walletAddress,
			userStats,
			referrals: referralsData,
			wins: winsData,
			recentShots: shotsData
		};
	} catch (err) {
		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('Unexpected error in user profile load:', err);
		throw error(500, 'An unexpected error occurred');
	}
}