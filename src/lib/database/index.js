/**
 * Database Module - Main Export
 * 
 * Refactored database operations with modular architecture.
 * This file maintains backward compatibility with the original supabase.js exports.
 */

import { supabase, TABLES, isSupabaseAvailable, getSupabaseClient } from './client.js';
import { getPlayer, upsertPlayer, getTopPlayers, getLeaderboard } from './players.js';
import { withAuthenticatedClient } from './authenticated-client.js';
import { NETWORK_CONFIG } from '../config.js';
import { ProfileAPI, profileAPI } from '../api/profile.js';
import {
  createReferralCodeAPI,
  processReferralSignupAPI,
  useReferralDiscountAPI,
  getReferralStatsAPI,
  getReferralCodeAPI,
  validateReferralCodeAPI
} from '../utils/client-referral.js';

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

      // Try JWT authentication first
      const jwtToken = localStorage.getItem('ethshot_jwt_token');
      const storedWalletAddress = localStorage.getItem('ethshot_wallet_address');
      
      if (jwtToken && storedWalletAddress && storedWalletAddress.toLowerCase() === shotData.playerAddress.toLowerCase()) {
        try {
          console.log('🔐 Attempting JWT authenticated shot recording...');
          return await withAuthenticatedClient(async (client) => {
            const { data, error } = await client
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
              console.error('❌ Authenticated recordShot error:', error);
              throw error;
            }
            
            console.log('✅ Shot recorded successfully with JWT authentication:', data);
            return data;
          });
        } catch (jwtError) {
          console.warn('⚠️ JWT authentication failed, falling back to public insert:', jwtError.message);
        }
      } else {
        console.log('ℹ️ No valid JWT token found, using public insert for shot recording');
      }

      // Fallback: Use public client for users without profiles
      // This ensures shots are recorded and triggers fire to update player statistics
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      console.log('📝 Recording shot with public client (fallback)...');
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
        console.error('❌ Public recordShot error:', error);
        throw error;
      }
      
      console.log('✅ Shot recorded successfully with public client:', data);
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

      // More flexible contract address filtering - include NULL addresses for backward compatibility
      if (contractAddress) {
        query = query.or(`contract_address.eq.${contractAddress},contract_address.is.null`);
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
    try {
      console.log('🏆 Recording winner to Supabase:', {
        winner_address: winnerData.winnerAddress.toLowerCase(),
        amount: winnerData.amount,
        tx_hash: winnerData.txHash,
        block_number: winnerData.blockNumber,
        timestamp: winnerData.timestamp || new Date().toISOString(),
        crypto_type: winnerData.cryptoType || 'ETH',
        contract_address: winnerData.contractAddress
      });

      // Try JWT authentication first
      const jwtToken = localStorage.getItem('ethshot_jwt_token');
      const storedWalletAddress = localStorage.getItem('ethshot_wallet_address');
      
      if (jwtToken && storedWalletAddress && storedWalletAddress.toLowerCase() === winnerData.winnerAddress.toLowerCase()) {
        try {
          console.log('🔐 Attempting JWT authenticated winner recording...');
          return await withAuthenticatedClient(async (client) => {
            const { data, error } = await client
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

            if (error) {
              console.error('❌ Authenticated recordWinner error:', error);
              throw error;
            }
            
            console.log('✅ Winner recorded successfully with JWT authentication:', data);
            return data;
          });
        } catch (jwtError) {
          console.warn('⚠️ JWT authentication failed for winner recording, falling back to public insert:', jwtError.message);
        }
      } else {
        console.log('ℹ️ No valid JWT token found, using public insert for winner recording');
      }

      // Fallback: Use public client for winner recording
      // This ensures winners are recorded even without profiles
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      console.log('📝 Recording winner with public client (fallback)...');
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

      if (error) {
        console.error('❌ Public recordWinner error:', error);
        throw error;
      }
      
      console.log('✅ Winner recorded successfully with public client:', data);
      return data;
    } catch (error) {
      console.error('❌ Error recording winner:', error);
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

      // More flexible contract address filtering - include NULL addresses for backward compatibility
      if (contractAddress) {
        query = query.or(`contract_address.eq.${contractAddress},contract_address.is.null`);
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
  async getUserProfile(walletAddress, customFetch = null) {
    try {
      console.log('🔍 Getting user profile via ProfileAPI:', { walletAddress });

      // Create ProfileAPI instance with custom fetch for server-side compatibility
      const profileAPIInstance = customFetch ? new ProfileAPI(customFetch) : new ProfileAPI();
      const result = await profileAPIInstance.getProfile(walletAddress);
      
      console.log('✅ User profile retrieved successfully via ProfileAPI:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting user profile via ProfileAPI:', error);
      
      // If ProfileAPI fails, try fallback to server API
      if (customFetch) {
        try {
          console.log('🔍 Getting user profile via server API:', { walletAddress });
          
          // Use server-side supabase client as fallback
          if (!supabase) {
            console.warn('Supabase not configured - returning null for getUserProfile');
            return null;
          }

          const { data, error: dbError } = await supabase
            .from(TABLES.USER_PROFILES)
            .select('*')
            .eq('wallet_address', walletAddress.toLowerCase())
            .single();

          if (dbError) {
            if (dbError.code === 'PGRST116') {
              console.log('ℹ️ Profile not found for wallet:', walletAddress);
              return null;
            }
            throw dbError;
          }

          console.log('✅ Profile retrieved successfully via server API:', data);
          return data;
        } catch (fallbackError) {
          console.error('❌ Fallback server API also failed:', fallbackError);
          // Return null for profile not found, but throw for other errors
          if (fallbackError.message?.includes('not found') || fallbackError.code === 'PGRST116') {
            return null;
          }
          throw fallbackError;
        }
      }
      
      // Return null for profile not found, but throw for other errors
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  async upsertUserProfile(profileData) {
    try {
      console.log('🔄 Upserting user profile via ProfileAPI:', {
        nickname: profileData.nickname,
        avatar_url: profileData.avatarUrl,
        bio: profileData.bio,
        notifications_enabled: profileData.notificationsEnabled
      });

      // Use the new ProfileAPI client with JWT authentication
      const result = await profileAPI.upsertProfile(profileData);
      
      console.log('✅ User profile upserted successfully via ProfileAPI:', result);
      return result;
    } catch (error) {
      console.error('❌ Error upserting user profile via ProfileAPI:', error);
      throw error;
    }
  },

  async isNicknameAvailable(nickname, excludeWalletAddress = null) {
    try {
      console.log('🔍 Checking nickname availability via ProfileAPI:', { nickname, excludeWalletAddress });

      // Use the new ProfileAPI client
      const result = await profileAPI.checkNicknameAvailability(nickname, excludeWalletAddress);
      
      console.log('✅ Nickname availability checked successfully via ProfileAPI:', result);
      return result;
    } catch (error) {
      console.error('❌ Error checking nickname availability via ProfileAPI:', error);
      // Return false on error to be safe (assume nickname is not available)
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
    try {
      console.log('🔗 Creating referral code via secure API:', { referrerAddress });

      // Use the new API-based referral code creation
      const result = await createReferralCodeAPI(referrerAddress);
      
      console.log('✅ Referral code created successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating referral code via API:', error);
      throw error;
    }
  },

  async processReferralSignup(referralCode, refereeAddress) {
    try {
      console.log('🔗 Processing referral signup via secure API:', { referralCode, refereeAddress });

      // Use the new API-based referral signup processing
      const result = await processReferralSignupAPI(referralCode, refereeAddress);
      
      console.log('✅ Referral signup processed successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error processing referral signup via API:', error);
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
    try {
      console.log('🔗 Using referral discount via secure API:', { discountId, userId });

      // Use the new API-based referral discount usage
      const result = await useReferralDiscountAPI(discountId, userId);
      
      console.log('✅ Referral discount used successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error using referral discount via API:', error);
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
    try {
      console.log('🔗 Getting referral stats via secure API:', { playerAddress });

      // Use the new API-based referral stats retrieval
      const result = await getReferralStatsAPI(playerAddress);
      
      console.log('✅ Referral stats retrieved successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting referral stats via API:', error);
      return null;
    }
  },

  async getReferralCode(referrerAddress) {
    try {
      console.log('🔗 Getting referral code via secure API:', { referrerAddress });

      // Use the new API-based referral code retrieval
      const result = await getReferralCodeAPI(referrerAddress);
      
      console.log('✅ Referral code retrieved successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting referral code via API:', error);
      return null;
    }
  },

  async validateReferralCode(referralCode) {
    try {
      console.log('🔗 Validating referral code via secure API:', { referralCode });

      // Use the new API-based referral code validation
      const result = await validateReferralCodeAPI(referralCode);
      
      console.log('✅ Referral code validated successfully via API:', result);
      return result;
    } catch (error) {
      console.error('❌ Error validating referral code via API:', error);
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