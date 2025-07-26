/**
 * Database Module - Main Export
 * 
 * Refactored database operations with modular architecture.
 * This file maintains backward compatibility with the original supabase.js exports.
 */

import { supabase, TABLES, isSupabaseAvailable, getSupabaseClient } from './client.js';
import { getPlayer, upsertPlayer, getTopPlayers, getLeaderboard } from './players.js';
import { NETWORK_CONFIG } from '../config.js';

// Re-export client utilities
export { supabase, TABLES, isSupabaseAvailable, getSupabaseClient };

// Utility functions (maintaining backward compatibility)
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

// Database functions for ETH Shot game (maintaining backward compatibility)
export const db = {
  // Player operations
  getPlayer,
  upsertPlayer,
  getTopPlayers,
  getLeaderboard,

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
        crypto_type: shotData.cryptoType || 'ETH',
        contract_address: shotData.contractAddress
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
          crypto_type: shotData.cryptoType || 'ETH',
          contract_address: shotData.contractAddress
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

  // Commit-reveal specific shot operations (simplified for current schema)
  async recordShotCommit(commitData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for recordShotCommit');
      return null;
    }

    try {
      console.log('🔒 Recording shot commit to Supabase:', {
        player_address: commitData.playerAddress.toLowerCase(),
        amount: commitData.amount,
        tx_hash: commitData.txHash,
        block_number: commitData.blockNumber,
        timestamp: commitData.timestamp || new Date().toISOString(),
        crypto_type: commitData.cryptoType || 'ETH',
        contract_address: commitData.contractAddress
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
          crypto_type: commitData.cryptoType || 'ETH',
          contract_address: commitData.contractAddress
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
      const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
      
      let query = supabase
        .from(TABLES.SHOTS)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      // Filter by contract address if available
      if (contractAddress) {
        query = query.eq('contract_address', contractAddress);
      }

      const { data, error } = await query;

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
          crypto_type: winnerData.cryptoType || 'ETH',
          contract_address: winnerData.contractAddress
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
      const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
      
      let query = supabase
        .from(TABLES.WINNERS)
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      // Filter by contract address if available
      if (contractAddress) {
        query = query.eq('contract_address', contractAddress);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent winners:', error);
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
          crypto_type: sponsorData.cryptoType || 'ETH',
          contract_address: sponsorData.contractAddress
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
      const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
      
      let query = supabase
        .from(TABLES.SPONSORS)
        .select('*')
        .eq('active', true)
        .order('timestamp', { ascending: false })
        .limit(1);

      // Filter by contract address if available
      if (contractAddress) {
        query = query.eq('contract_address', contractAddress);
      }

      const { data, error } = await query;

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
      const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
      
      let query = supabase
        .from(TABLES.SPONSORS)
        .update({ active: false })
        .eq('active', true);

      // Filter by contract address if available
      if (contractAddress) {
        query = query.eq('contract_address', contractAddress);
      }

      const { error } = await query;

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

  // User Profile operations
  async getUserProfile(walletAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for getUserProfile');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_profile', {
        wallet_addr: walletAddress.toLowerCase()
      });

      if (error) {
        console.warn('Supabase getUserProfile query error (expected if profile not found):', error);
        return null;
      }

      // Return first item if exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.warn('Error fetching user profile (expected if profile not found):', error);
      return null;
    }
  },

  async upsertUserProfile(profileData) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for upsertUserProfile');
      return null;
    }

    try {
      console.log('🔄 Upserting user profile to Supabase (secure):', {
        nickname: profileData.nickname,
        avatar_url: profileData.avatarUrl,
        bio: profileData.bio,
        notifications_enabled: profileData.notificationsEnabled
        // Note: wallet address is now obtained from authenticated user, not from client
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile update timed out after 30 seconds')), 30000);
      });

      // Use the secure version that gets wallet address from authentication
      const updatePromise = supabase.rpc('upsert_user_profile_secure', {
        p_nickname: profileData.nickname || null,
        p_avatar_url: profileData.avatarUrl || null,
        p_bio: profileData.bio || null,
        p_notifications_enabled: profileData.notificationsEnabled ?? true
      });

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        console.error('❌ Supabase upsertUserProfile error:', error);
        
        // Provide more helpful error messages for common authentication issues
        if (error.message?.includes('No authenticated wallet address found')) {
          throw new Error('You must be logged in with a wallet to update your profile.');
        } else if (error.message?.includes('JWT')) {
          throw new Error('Authentication error. Please reconnect your wallet and try again.');
        }
        
        throw error;
      }
      
      console.log('✅ User profile upserted successfully:', data);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('❌ Error upserting user profile:', error);
      throw error;
    }
  },

  async isNicknameAvailable(nickname, excludeWalletAddress = null) {
    if (!supabase) {
      console.warn('Supabase not configured - returning false for isNicknameAvailable');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('is_nickname_available', {
        p_nickname: nickname,
        exclude_wallet_addr: excludeWalletAddress?.toLowerCase() || null
      });

      if (error) {
        console.error('Error checking nickname availability:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking nickname availability:', error);
      return false;
    }
  },

  async getUserProfiles(walletAddresses) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getUserProfiles');
      return [];
    }

    if (!walletAddresses || walletAddresses.length === 0) {
      return [];
    }

    try {
      // Convert addresses to lowercase for consistent querying
      const normalizedAddresses = walletAddresses.map(addr => addr.toLowerCase());

      const { data, error } = await supabase
        .from(TABLES.USER_PROFILES)
        .select('wallet_address, nickname, avatar_url, bio, created_at, updated_at')
        .in('wallet_address', normalizedAddresses);

      if (error) {
        console.warn('Supabase getUserProfiles query error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('Error fetching user profiles:', error);
      return [];
    }
  },

  async uploadAvatar(file, walletAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning null for uploadAvatar');
      return null;
    }

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${walletAddress.toLowerCase()}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      console.log('📤 Uploading avatar to Supabase Storage:', {
        fileName,
        filePath,
        fileSize: file.size,
        fileType: file.type
      });

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Avatar upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('✅ Avatar uploaded successfully:', {
        path: uploadData.path,
        publicUrl: urlData.publicUrl
      });

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      throw error;
    }
  },

  async deleteAvatar(avatarUrl) {
    if (!supabase || !avatarUrl) {
      console.warn('Supabase not configured or no avatar URL provided');
      return false;
    }

    try {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // Get 'avatars/filename.ext'

      console.log('🗑️ Deleting avatar from Supabase Storage:', filePath);

      const { error } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (error) {
        console.error('❌ Avatar deletion error:', error);
        throw error;
      }

      console.log('✅ Avatar deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting avatar:', error);
      return false;
    }
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

  async getUserDiscounts(walletAddress) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty array for getUserDiscounts');
      return [];
    }

    try {
      // According to the migration, this function intentionally returns empty results
      // and is not used by the frontend. We'll query the referral_discounts table directly.
      const { data, error } = await supabase
        .from(TABLES.REFERRAL_DISCOUNTS)
        .select('id, discount_type, discount_percentage, expires_at, created_at')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

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
        event: '*',
        schema: 'public',
        table: TABLES.SPONSORS,
      }, callback)
      .subscribe();
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