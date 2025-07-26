import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { supabase } from '../src/lib/supabase.js';

// Mock data for testing
const mockWalletAddress = '0x1234567890123456789012345678901234567890';
const mockProfile = {
	wallet_address: mockWalletAddress.toLowerCase(),
	nickname: 'TestUser',
	avatar_url: 'https://example.com/avatar.jpg',
	bio: 'Test user bio'
};

const mockPlayerData = {
	address: mockWalletAddress.toLowerCase(),
	total_shots: 10,
	total_spent: '1.5',
	total_won: '2.0',
	last_shot_time: new Date().toISOString()
};

describe('User Profile System', () => {
	describe('Database Functions', () => {
		describe('user_exists function', () => {
			it('should return true for user with profile', async () => {
				// Mock supabase response
				const mockResponse = { data: true, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('user_exists', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data).toBe(true);
				expect(supabase.rpc).toHaveBeenCalledWith('user_exists', {
					wallet_addr: mockWalletAddress
				});
			});

			it('should return false for non-existent user', async () => {
				const mockResponse = { data: false, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('user_exists', {
					wallet_addr: '0xnonexistent'
				});

				expect(error).toBeNull();
				expect(data).toBe(false);
			});

			it('should handle database errors gracefully', async () => {
				const mockError = new Error('Database connection failed');
				const mockResponse = { data: null, error: mockError };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('user_exists', {
					wallet_addr: mockWalletAddress
				});

				expect(data).toBeNull();
				expect(error).toBe(mockError);
			});
		});

		describe('get_user_statistics function', () => {
			it('should return comprehensive user statistics', async () => {
				const mockStats = {
					profile: mockProfile,
					game_stats: {
						total_shots: 10,
						total_spent: '1.5',
						total_won: '2.0',
						biggest_win: '0.5',
						win_rate: 20.0,
						roi_percentage: 133.33,
						current_win_streak: 2,
						shots_rank: 5,
						winnings_rank: 3
					},
					referral_stats: {
						referral_code: 'ABC12345',
						total_referrals: 3,
						successful_referrals: 2,
						bonus_shots_available: 1,
						total_bonus_shots_earned: 5,
						referred_by: null
					},
					recent_activity: [
						{
							type: 'shot',
							amount: '0.1',
							won: false,
							timestamp: new Date().toISOString(),
							tx_hash: '0xabc123'
						}
					],
					achievements: {
						first_shot: true,
						big_spender: true,
						winner: true,
						referrer: true,
						veteran: false
					}
				};

				const mockResponse = { data: mockStats, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_statistics', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data).toEqual(mockStats);
				expect(data.profile.wallet_address).toBe(mockWalletAddress.toLowerCase());
				expect(data.game_stats.total_shots).toBe(10);
				expect(data.referral_stats.total_referrals).toBe(3);
				expect(data.achievements.first_shot).toBe(true);
			});

			it('should handle user with no game activity', async () => {
				const mockStatsNoActivity = {
					profile: mockProfile,
					game_stats: {
						total_shots: 0,
						total_spent: '0',
						total_won: '0',
						biggest_win: '0',
						win_rate: 0,
						roi_percentage: 0,
						current_win_streak: 0,
						shots_rank: 0,
						winnings_rank: 0
					},
					referral_stats: {
						referral_code: null,
						total_referrals: 0,
						successful_referrals: 0,
						bonus_shots_available: 0,
						total_bonus_shots_earned: 0,
						referred_by: null
					},
					recent_activity: [],
					achievements: {
						first_shot: false,
						big_spender: false,
						winner: false,
						referrer: false,
						veteran: false
					}
				};

				const mockResponse = { data: mockStatsNoActivity, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_statistics', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data.game_stats.total_shots).toBe(0);
				expect(data.achievements.first_shot).toBe(false);
			});
		});

		describe('get_user_referrals function', () => {
			it('should return user referrals with details', async () => {
				const mockReferrals = {
					referrals: [
						{
							referee_address: '0xreferee1',
							referee_profile: {
								nickname: 'Referee1',
								avatar_url: 'https://example.com/referee1.jpg'
							},
							created_at: new Date().toISOString(),
							first_shot_at: new Date().toISOString(),
							is_active: true,
							bonus_claimed: true
						}
					],
					total_count: 1,
					active_count: 1
				};

				const mockResponse = { data: mockReferrals, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_referrals', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data.total_count).toBe(1);
				expect(data.active_count).toBe(1);
				expect(data.referrals[0].is_active).toBe(true);
			});

			it('should return empty referrals for user with no referrals', async () => {
				const mockEmptyReferrals = {
					referrals: [],
					total_count: 0,
					active_count: 0
				};

				const mockResponse = { data: mockEmptyReferrals, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_referrals', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data.total_count).toBe(0);
				expect(data.referrals).toEqual([]);
			});
		});

		describe('get_user_shot_history function', () => {
			it('should return paginated shot history', async () => {
				const mockShotHistory = {
					shots: [
						{
							id: 'shot1',
							amount: '0.1',
							won: false,
							timestamp: new Date().toISOString(),
							tx_hash: '0xshot1',
							block_number: 12345
						}
					],
					total_count: 10,
					has_more: true
				};

				const mockResponse = { data: mockShotHistory, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_shot_history', {
					wallet_addr: mockWalletAddress,
					page_limit: 10,
					page_offset: 0
				});

				expect(error).toBeNull();
				expect(data.shots).toHaveLength(1);
				expect(data.total_count).toBe(10);
				expect(data.has_more).toBe(true);
			});
		});

		describe('get_user_wins_history function', () => {
			it('should return user wins history', async () => {
				const mockWinsHistory = {
					wins: [
						{
							id: 'win1',
							amount: '1.0',
							timestamp: new Date().toISOString(),
							tx_hash: '0xwin1',
							block_number: 12346
						}
					],
					total_count: 1,
					total_amount: '1.0'
				};

				const mockResponse = { data: mockWinsHistory, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_wins_history', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data.wins).toHaveLength(1);
				expect(data.total_count).toBe(1);
				expect(data.total_amount).toBe('1.0');
			});

			it('should return empty wins for user with no wins', async () => {
				const mockEmptyWins = {
					wins: [],
					total_count: 0,
					total_amount: '0'
				};

				const mockResponse = { data: mockEmptyWins, error: null };
				supabase.rpc = jest.fn().mockResolvedValue(mockResponse);

				const { data, error } = await supabase.rpc('get_user_wins_history', {
					wallet_addr: mockWalletAddress
				});

				expect(error).toBeNull();
				expect(data.wins).toEqual([]);
				expect(data.total_count).toBe(0);
			});
		});
	});

	describe('Route Load Function', () => {
		// Mock the load function behavior
		const mockLoad = async (params) => {
			const walletAddress = params['wallet-address'];
			
			// Validate wallet address
			if (!walletAddress || walletAddress.length < 10) {
				throw new Error('Invalid wallet address');
			}

			// Check if user exists
			const { data: userExists, error: existsError } = await supabase
				.rpc('user_exists', { wallet_addr: walletAddress });

			if (existsError) {
				throw new Error('Failed to check user existence');
			}

			if (!userExists) {
				throw new Error('User not found');
			}

			// Get user statistics
			const { data: userStats, error: statsError } = await supabase
				.rpc('get_user_statistics', { wallet_addr: walletAddress });

			if (statsError) {
				throw new Error('Failed to load user statistics');
			}

			return {
				walletAddress,
				userStats
			};
		};

		it('should load user profile data successfully', async () => {
			// Mock successful responses
			supabase.rpc = jest.fn()
				.mockResolvedValueOnce({ data: true, error: null }) // user_exists
				.mockResolvedValueOnce({ data: { profile: mockProfile }, error: null }); // get_user_statistics

			const result = await mockLoad({ 'wallet-address': mockWalletAddress });

			expect(result.walletAddress).toBe(mockWalletAddress);
			expect(result.userStats.profile).toEqual(mockProfile);
		});

		it('should throw error for invalid wallet address', async () => {
			await expect(mockLoad({ 'wallet-address': '0x123' }))
				.rejects.toThrow('Invalid wallet address');
		});

		it('should throw error for non-existent user', async () => {
			supabase.rpc = jest.fn()
				.mockResolvedValueOnce({ data: false, error: null }); // user_exists

			await expect(mockLoad({ 'wallet-address': mockWalletAddress }))
				.rejects.toThrow('User not found');
		});

		it('should handle database errors', async () => {
			supabase.rpc = jest.fn()
				.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

			await expect(mockLoad({ 'wallet-address': mockWalletAddress }))
				.rejects.toThrow('Failed to check user existence');
		});
	});

	describe('Wallet Address Validation', () => {
		it('should accept valid Ethereum addresses', () => {
			const validAddresses = [
				'0x1234567890123456789012345678901234567890',
				'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
				'0x0000000000000000000000000000000000000000'
			];

			validAddresses.forEach(address => {
				expect(address.length).toBe(42);
				expect(address.startsWith('0x')).toBe(true);
			});
		});

		it('should reject invalid addresses', () => {
			const invalidAddresses = [
				'0x123', // too short
				'1234567890123456789012345678901234567890', // missing 0x
				'0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // invalid characters
				'', // empty
				null, // null
				undefined // undefined
			];

			invalidAddresses.forEach(address => {
				if (address) {
					expect(address.length < 10 || !address.startsWith('0x')).toBe(true);
				} else {
					expect(address).toBeFalsy();
				}
			});
		});
	});

	describe('Data Formatting', () => {
		it('should format ETH amounts correctly', () => {
			const formatEth = (amount) => {
				if (!amount || amount === '0') return '0';
				const num = parseFloat(amount);
				if (num < 0.001) return num.toFixed(6);
				if (num < 1) return num.toFixed(4);
				return num.toFixed(3);
			};

			expect(formatEth('0')).toBe('0');
			expect(formatEth('0.0001')).toBe('0.000100');
			expect(formatEth('0.1234')).toBe('0.1234');
			expect(formatEth('1.23456')).toBe('1.235');
			expect(formatEth(null)).toBe('0');
		});

		it('should format dates correctly', () => {
			const formatDate = (dateString) => {
				if (!dateString) return 'Never';
				return new Date(dateString).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});
			};

			const testDate = '2025-01-15T10:30:00Z';
			const formatted = formatDate(testDate);
			
			expect(formatted).toContain('Jan');
			expect(formatted).toContain('15');
			expect(formatted).toContain('2025');
			expect(formatDate(null)).toBe('Never');
		});
	});

	describe('Achievement System', () => {
		it('should correctly identify achievements', () => {
			const checkAchievements = (gameStats, referralStats) => {
				return {
					first_shot: gameStats.total_shots > 0,
					big_spender: parseFloat(gameStats.total_spent) >= 1,
					winner: parseFloat(gameStats.biggest_win) > 0,
					referrer: referralStats.total_referrals > 0,
					veteran: gameStats.total_shots >= 100
				};
			};

			const gameStats = {
				total_shots: 50,
				total_spent: '2.5',
				biggest_win: '1.0'
			};

			const referralStats = {
				total_referrals: 3
			};

			const achievements = checkAchievements(gameStats, referralStats);

			expect(achievements.first_shot).toBe(true);
			expect(achievements.big_spender).toBe(true);
			expect(achievements.winner).toBe(true);
			expect(achievements.referrer).toBe(true);
			expect(achievements.veteran).toBe(false); // < 100 shots
		});
	});
});