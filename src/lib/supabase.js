import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Supabase configuration from centralized config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Validate required environment variables
const hasValidConfig = supabaseUrl && supabaseAnonKey;

if (!hasValidConfig) {
  console.warn('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
}

// Create Supabase client only if configuration is valid
export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: browser,
        autoRefreshToken: browser,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Database table names
export const TABLES = {
  PLAYERS: 'players',
  SHOTS: 'shots',
  WINNERS: 'winners',
  SPONSORS: 'sponsors',
  GAME_STATS: 'game_stats',
  LEADERBOARD: 'leaderboard',
  REFERRAL_CODES: 'referral_codes',
  REFERRALS: 'referrals',
  REFERRAL_DISCOUNTS: 'referral_discounts',
};

// Database functions for ETH Shot game
export const db = {
  // Player operations
  async getPlayer(address) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getPlayer');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .select('*')
        .eq('address', address.toLowerCase())
        .limit(1);

      if (error) {
        console.warn('Supabase getPlayer query error (expected if player not found):', error);
        return null;
      }

      // Return first item if exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.warn('Error fetching player (expected if player not found):', error);
      return null;
    }
  },

  async upsertPlayer(playerData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for upsertPlayer');
      return null;
    }

    try {
      console.log('🔄 Upserting player to Supabase:', {
        address: playerData.address.toLowerCase(),
        total_shots: playerData.totalShots || 0,
        total_spent: playerData.totalSpent || '0',
        total_won: playerData.totalWon || '0',
        last_shot_time: playerData.lastShotTime || null
      });

      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .upsert({
          address: playerData.address.toLowerCase(),
          total_shots: playerData.totalShots || 0,
          total_spent: playerData.totalSpent || '0',
          total_won: playerData.totalWon || '0',
          last_shot_time: playerData.lastShotTime || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'address',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase upsertPlayer error:', error);
        throw error;
      }
      
      console.log('✅ Player upserted successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error upserting player:', error);
      throw error;
    }
  },

  // Shot operations
  async recordShot(shotData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordShot');
      return null;
    }

    try {
      console.log('🎯 Recording shot to Supabase:', {
        player_address: shotData.playerAddress.toLowerCase(),
        amount: shotData.amount,
        won: shotData.won || false,
        tx_hash: shotData.txHash,
        block_number: shotData.blockNumber,
        timestamp: shotData.timestamp || new Date().toISOString(),
        status: shotData.status || 'completed', // For commit-reveal: 'committed', 'revealed', 'completed'
        commitment_hash: shotData.commitmentHash || null,
        reveal_tx_hash: shotData.revealTxHash || null
      });

      const { data, error } = await supabase
        .from(TABLES.SHOTS)
        .insert({
          player_address: shotData.playerAddress.toLowerCase(),
          amount: shotData.amount,
          won: shotData.won || false,
          tx_hash: shotData.txHash,
          block_number: shotData.blockNumber,
          timestamp: shotData.timestamp || new Date().toISOString(),
          status: shotData.status || 'completed',
          commitment_hash: shotData.commitmentHash || null,
          reveal_tx_hash: shotData.revealTxHash || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase recordShot error:', error);
        throw error;
      }
      
      console.log('✅ Shot recorded successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error recording shot:', error);
      throw error;
    }
  },

  // Commit-reveal specific shot operations
  async recordShotCommit(commitData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordShotCommit');
      return null;
    }

    try {
      console.log('🔒 Recording shot commit to Supabase:', {
        player_address: commitData.playerAddress.toLowerCase(),
        amount: commitData.amount,
        commitment_hash: commitData.commitmentHash,
        tx_hash: commitData.txHash,
        block_number: commitData.blockNumber,
        timestamp: commitData.timestamp || new Date().toISOString()
      });

      const { data, error } = await supabase
        .from(TABLES.SHOTS)
        .insert({
          player_address: commitData.playerAddress.toLowerCase(),
          amount: commitData.amount,
          won: false, // Unknown until revealed
          tx_hash: commitData.txHash,
          block_number: commitData.blockNumber,
          timestamp: commitData.timestamp || new Date().toISOString(),
          status: 'committed',
          commitment_hash: commitData.commitmentHash,
          crypto_type: commitData.cryptoType || 'ETH',
          used_discount: commitData.usedDiscount || false,
          discount_id: commitData.discountId || null,
          used_bonus: commitData.usedBonus || false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase recordShotCommit error:', error);
        throw error;
      }
      
      console.log('✅ Shot commit recorded successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error recording shot commit:', error);
      throw error;
    }
  },

  async updateShotResult(updateData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for updateShotResult');
      return null;
    }

    try {
      console.log('🔓 Updating shot result in Supabase:', {
        commitment_hash: updateData.commitmentHash,
        won: updateData.won,
        reveal_tx_hash: updateData.revealTxHash,
        reveal_block_number: updateData.revealBlockNumber
      });

      const { data, error } = await supabase
        .from(TABLES.SHOTS)
        .update({
          won: updateData.won,
          status: 'revealed',
          reveal_tx_hash: updateData.revealTxHash,
          reveal_block_number: updateData.revealBlockNumber,
          reveal_timestamp: updateData.revealTimestamp || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('commitment_hash', updateData.commitmentHash)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase updateShotResult error:', error);
        throw error;
      }
      
      console.log('✅ Shot result updated successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error updating shot result:', error);
      throw error;
    }
  },

  async recordPayoutClaim(claimData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordPayoutClaim');
      return null;
    }

    try {
      console.log('💰 Recording payout claim to Supabase:', {
        player_address: claimData.playerAddress.toLowerCase(),
        amount: claimData.amount,
        tx_hash: claimData.txHash,
        block_number: claimData.blockNumber,
        timestamp: claimData.timestamp || new Date().toISOString()
      });

      // Create a new table entry for payout claims or add to existing shots table
      const { data, error } = await supabase
        .from('payout_claims') // Assuming we have a separate table for payout claims
        .insert({
          player_address: claimData.playerAddress.toLowerCase(),
          amount: claimData.amount,
          tx_hash: claimData.txHash,
          block_number: claimData.blockNumber,
          timestamp: claimData.timestamp || new Date().toISOString(),
          crypto_type: claimData.cryptoType || 'ETH'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase recordPayoutClaim error:', error);
        throw error;
      }
      
      console.log('✅ Payout claim recorded successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error recording payout claim:', error);
      throw error;
    }
  },

  async getRecentShots(limit = 50) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getRecentShots');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.SHOTS)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent shots:', error);
      return [];
    }
  },

  // Winner operations
  async recordWinner(winnerData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordWinner');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.WINNERS)
        .insert({
          winner_address: winnerData.winnerAddress.toLowerCase(),
          amount: winnerData.amount,
          tx_hash: winnerData.txHash,
          block_number: winnerData.blockNumber,
          timestamp: winnerData.timestamp || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording winner:', error);
      throw error;
    }
  },

  async getRecentWinners(limit = 10) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getRecentWinners');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.WINNERS)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent winners:', error);
      return [];
    }
  },

  // Leaderboard operations
  async getTopPlayers(limit = 10, orderBy = 'total_shots') {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getTopPlayers');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .select('*')
        .order(orderBy, { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Supabase getTopPlayers query error (expected if no data yet):', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn('Error fetching top players (expected if no data yet):', error);
      return [];
    }
  },

  async getLeaderboard(limit = 10) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getLeaderboard');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.LEADERBOARD)
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Supabase leaderboard query error (expected if no data yet):', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('Error fetching leaderboard (expected if no data yet):', error);
      return [];
    }
  },

  // Sponsor operations
  async recordSponsor(sponsorData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordSponsor');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.SPONSORS)
        .insert({
          sponsor_address: sponsorData.sponsorAddress.toLowerCase(),
          name: sponsorData.name,
          logo_url: sponsorData.logoUrl,
          sponsor_url: sponsorData.sponsorUrl,
          amount: sponsorData.amount,
          tx_hash: sponsorData.txHash,
          active: true,
          timestamp: sponsorData.timestamp || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording sponsor:', error);
      throw error;
    }
  },

  async getCurrentSponsor() {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getCurrentSponsor');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.SPONSORS)
        .select('*')
        .eq('active', true)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      // Return first item if exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error fetching current sponsor:', error);
      return null;
    }
  },

  async deactivateCurrentSponsor() {
    if (!supabase) {
      console.warn('Supabase not configured - skipping deactivateCurrentSponsor');
      return;
    }

    try {
      const { error } = await supabase
        .from(TABLES.SPONSORS)
        .update({ active: false })
        .eq('active', true);

      if (error) throw error;
    } catch (error) {
      console.error('Error deactivating sponsor:', error);
      throw error;
    }
  },

  // Game statistics
  async updateGameStats(stats) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for updateGameStats');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.GAME_STATS)
        .upsert({
          id: 1, // Single row for global stats
          total_shots: stats.totalShots,
          total_players: stats.totalPlayers,
          total_pot_won: stats.totalPotWon,
          current_pot: stats.currentPot,
          last_winner: stats.lastWinner,
          last_win_amount: stats.lastWinAmount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating game stats:', error);
      throw error;
    }
  },

  async getGameStats() {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getGameStats');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.GAME_STATS)
        .select('*')
        .eq('id', 1)
        .limit(1);

      if (error) {
        console.warn('Supabase getGameStats query error (expected if no data yet):', error);
        return null;
      }

      // Return first item if exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.warn('Error fetching game stats (expected if no data yet):', error);
      return null;
    }
  },

  // Real-time subscriptions
  subscribeToWinners(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToWinners');
      return null;
    }

    return supabase
      .channel('winners')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.WINNERS,
      }, callback)
      .subscribe();
  },

  subscribeToShots(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToShots');
      return null;
    }

    return supabase
      .channel('shots')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.SHOTS,
      }, callback)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.SHOTS,
      }, callback)
      .subscribe();
  },

  subscribeToShotCommits(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToShotCommits');
      return null;
    }

    return supabase
      .channel('shot_commits')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.SHOTS,
        filter: 'status=eq.committed'
      }, callback)
      .subscribe();
  },

  subscribeToShotReveals(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToShotReveals');
      return null;
    }

    return supabase
      .channel('shot_reveals')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: TABLES.SHOTS,
        filter: 'status=eq.revealed'
      }, callback)
      .subscribe();
  },

  subscribeToPayoutClaims(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToPayoutClaims');
      return null;
    }

    return supabase
      .channel('payout_claims')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'payout_claims',
      }, callback)
      .subscribe();
  },

  subscribeToSponsors(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToSponsors');
      return null;
    }

    return supabase
      .channel('sponsors')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.SPONSORS,
      }, callback)
      .subscribe();
  },

  // Referral system operations
  async createReferralCode(referrerAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for createReferralCode');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('create_referral_code', {
        referrer_addr: referrerAddress.toLowerCase()
      });

      if (error) {
        console.error('Error creating referral code:', error);
        throw error;
      }

      console.log('✅ Referral code created:', data);
      return data;
    } catch (error) {
      console.error('Error creating referral code:', error);
      throw error;
    }
  },

  async processReferralSignup(referralCode, refereeAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning false for processReferralSignup');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('process_referral_signup', {
        ref_code: referralCode,
        referee_addr: refereeAddress.toLowerCase()
      });

      if (error) {
        console.error('Error processing referral signup:', error);
        return false;
      }

      console.log('✅ Referral signup processed:', data);
      return data;
    } catch (error) {
      console.error('Error processing referral signup:', error);
      return false;
    }
  },

  async getUserDiscounts(userId) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getUserDiscounts');
      return [];
    }

    try {
      const { data, error } = await supabase.rpc('get_user_discounts', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error getting user discounts:', error);
        return [];
      }

      console.log('✅ User discounts retrieved:', data);
      return data || [];
    } catch (error) {
      console.error('Error getting user discounts:', error);
      return [];
    }
  },

  async useReferralDiscount(discountId, userId) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for useReferralDiscount');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('use_referral_discount', {
        p_discount_id: discountId,
        p_user_id: userId
      });

      if (error) {
        console.error('Error using referral discount:', error);
        return null;
      }

      console.log('✅ Referral discount used:', data);
      return data;
    } catch (error) {
      console.error('Error using referral discount:', error);
      return null;
    }
  },

  async getAvailableDiscountCount(userId) {
    if (!supabase) {
      console.warn('Supabase not configured - returning 0 for getAvailableDiscountCount');
      return 0;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.REFERRAL_DISCOUNTS)
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error getting available discount count:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error getting available discount count:', error);
      return 0;
    }
  },

  async getReferralStats(playerAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getReferralStats');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('get_referral_stats', {
        player_addr: playerAddress.toLowerCase()
      });

      if (error) {
        console.error('Error getting referral stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return null;
    }
  },

  async getReferralCode(referrerAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getReferralCode');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.REFERRAL_CODES)
        .select('code')
        .eq('referrer_address', referrerAddress.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error getting referral code:', error);
        return null;
      }

      return data && data.length > 0 ? data[0].code : null;
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  },

  async validateReferralCode(referralCode) {
    if (!supabase) {
      console.warn('Supabase not configured - returning false for validateReferralCode');
      return false;
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.REFERRAL_CODES)
        .select('*')
        .eq('code', referralCode)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Error validating referral code:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error validating referral code:', error);
      return false;
    }
  },

  async getReferralLeaderboard(options = {}) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getReferralLeaderboard');
      return [];
    }

    const {
      limit = 100,
      timeFilter = 'all',
      sortBy = 'successful_referrals'
    } = options;

    try {
      // Get referral codes with basic stats
      const { data: codes, error: codesError } = await supabase
        .from(TABLES.REFERRAL_CODES)
        .select('referrer_address, total_uses, created_at')
        .eq('is_active', true)
        .order('total_uses', { ascending: false })
        .limit(limit);

      if (codesError) throw codesError;

      // Get comprehensive stats for each referrer
      const leaderboardData = await Promise.all(
        (codes || []).map(async (code) => {
          // Get successful referrals count
          let referralsQuery = supabase
            .from(TABLES.REFERRALS)
            .select('id, created_at')
            .eq('referrer_address', code.referrer_address)
            .not('first_shot_at', 'is', null);

          // Apply time filter to referrals
          if (timeFilter === '7d') {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            referralsQuery = referralsQuery.gte('created_at', sevenDaysAgo);
          } else if (timeFilter === '30d') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            referralsQuery = referralsQuery.gte('created_at', thirtyDaysAgo);
          }

          const { data: referrals, error: referralsError } = await referralsQuery;

          // Get discounts earned (both used and unused)
          const { data: discounts, error: discountsError } = await supabase
            .from(TABLES.REFERRAL_DISCOUNTS)
            .select('discount_percentage, is_used')
            .eq('user_id', code.referrer_address)
            .eq('discount_type', 'referrer');

          const successfulReferrals = referralsError ? 0 : (referrals || []).length;
          const totalDiscountsEarned = discountsError ? 0 : (discounts || []).length;
          const usedDiscounts = discountsError ? 0 : (discounts || []).filter(d => d.is_used).length;
          
          // Calculate success rate based on time filter
          let totalReferralsForRate = code.total_uses;
          if (timeFilter !== 'all') {
            // For time-filtered views, use the filtered referral count as base
            totalReferralsForRate = successfulReferrals;
          }
          
          const successRate = totalReferralsForRate > 0 ? Math.round((successfulReferrals / totalReferralsForRate) * 100) : 0;

          return {
            referrer_address: code.referrer_address,
            total_referrals: code.total_uses,
            successful_referrals: successfulReferrals,
            success_rate: successRate,
            total_discounts_earned: totalDiscountsEarned,
            used_discounts: usedDiscounts,
            available_discounts: totalDiscountsEarned - usedDiscounts,
            created_at: code.created_at
          };
        })
      );

      // Sort based on sortBy parameter
      leaderboardData.sort((a, b) => {
        switch (sortBy) {
          case 'total_referrals':
            return b.total_referrals - a.total_referrals;
          case 'success_rate':
            return b.success_rate - a.success_rate;
          case 'successful_referrals':
          default:
            return b.successful_referrals - a.successful_referrals;
        }
      });

      return leaderboardData;
    } catch (error) {
      console.error('Error getting referral leaderboard:', error);
      return [];
    }
  },

  // Real-time subscriptions for referral system
  subscribeToReferrals(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToReferrals');
      return null;
    }

    return supabase
      .channel('referrals')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: TABLES.REFERRALS,
      }, callback)
      .subscribe();
  },

  subscribeToReferralDiscounts(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToReferralDiscounts');
      return null;
    }

    return supabase
      .channel('referral_discounts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.REFERRAL_DISCOUNTS,
      }, callback)
      .subscribe();
  },

  subscribeToReferralUpdates(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for subscribeToReferralUpdates');
      return null;
    }

    // Subscribe to multiple tables that affect referral leaderboard
    return supabase
      .channel('referral_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.REFERRAL_CODES,
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.REFERRALS,
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: TABLES.REFERRAL_DISCOUNTS,
      }, callback)
      .subscribe();
  },
};

// Utility functions
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatEther = (value) => {
  if (!value) return '0.000';
  return parseFloat(value).toFixed(3);
};

export const formatTimeAgo = (timestamp) => {
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