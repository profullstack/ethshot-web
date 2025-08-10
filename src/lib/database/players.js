/**
 * Players Database Operations
 *
 * Handles all player-related database operations
 */

import { supabase, TABLES } from './client.js';
import { withAuthenticatedClient } from './authenticated-client.js';
import { NETWORK_CONFIG } from '../config.js';

/**
 * Get player by wallet address
 * @param {string} address - Wallet address
 * @returns {Promise<Object|null>} Player data or null
 */
export const getPlayer = async (address) => {
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
};

/**
 * Upsert player data
 * @param {Object} playerData - Player data to upsert
 * @returns {Promise<Object|null>} Upserted player data or null
 */
export const upsertPlayer = async (playerData) => {
  try {
    console.log('🔄 Upserting player to Supabase with authentication:', {
      address: playerData.address.toLowerCase(),
      total_shots: playerData.totalShots || 0,
      total_spent: playerData.totalSpent || '0',
      total_won: playerData.totalWon || '0',
      last_shot_time: playerData.lastShotTime || null,
      crypto_type: playerData.cryptoType || 'ETH',
      contract_address: playerData.contractAddress
    });

    return await withAuthenticatedClient(async (client) => {
      const { data, error } = await client
        .from(TABLES.PLAYERS)
        .upsert({
          address: playerData.address.toLowerCase(),
          total_shots: playerData.totalShots || 0,
          total_spent: playerData.totalSpent || '0',
          total_won: playerData.totalWon || '0',
          last_shot_time: playerData.lastShotTime || null,
          crypto_type: playerData.cryptoType || 'ETH',
          contract_address: playerData.contractAddress,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'address',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Authenticated upsertPlayer error:', error);
        throw error;
      }
      
      console.log('✅ Player upserted successfully with authentication:', data);
      return data;
    });
  } catch (error) {
    console.error('❌ Error upserting player with authentication:', error);
    throw error;
  }
};

/**
 * Get top players by specified criteria
 * @param {number} limit - Number of players to return
 * @param {string} orderBy - Field to order by
 * @returns {Promise<Array>} Array of top players
 */
export const getTopPlayers = async (limit = 10, orderBy = 'total_shots') => {
  if (!supabase) {
    console.warn('Supabase not configured - returning empty array for getTopPlayers');
    return [];
  }

  try {
    const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;

    // Use the new contract-aware function
    const { data, error } = await supabase.rpc('get_top_players_by_contract', {
      p_contract_address: contractAddress || 'default',
      player_limit: limit,
      order_by_field: orderBy
    });

    // Fallback to a more permissive direct query when:
    // - RPC errors, or
    // - RPC succeeds but returns no rows (common when historical rows have NULL/default contract_address)
    if (error || !data || data.length === 0) {
      if (error) {
        console.warn('Supabase getTopPlayers RPC error, falling back to direct query:', error);
      } else {
        console.warn('Supabase getTopPlayers RPC returned no data, falling back to direct query for compatibility');
      }

      let query = supabase
        .from(TABLES.PLAYERS)
        .select('*')
        .gt('total_shots', 0) // Only include players with shots
        .order(orderBy, { ascending: false })
        .limit(limit);

      // Contract address filtering (include legacy rows with NULL or "default")
      if (contractAddress) {
        query = query.or(`contract_address.eq.${contractAddress},contract_address.is.null,contract_address.eq.default`);
      } else {
        query = query.or('contract_address.is.null,contract_address.eq.default');
      }

      const { data: fallbackData, error: fallbackError } = await query;

      if (fallbackError) {
        console.warn('Fallback getTopPlayers query also failed:', fallbackError);
        return [];
      }

      return fallbackData || [];
    }

    return data || [];
  } catch (error) {
    console.warn('Error fetching top players:', error);
    return [];
  }
};

/**
 * Get leaderboard data
 * @param {number} limit - Number of entries to return
 * @returns {Promise<Array>} Array of leaderboard entries
 */
export const getLeaderboard = async (limit = 10) => {
  if (!supabase) {
    console.warn('Supabase not configured - returning empty array for getLeaderboard');
    return [];
  }

  try {
    const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
    
    let query = supabase
      .from(TABLES.LEADERBOARD)
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    // Filter by contract address if available
    if (contractAddress) {
      query = query.eq('contract_address', contractAddress);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase leaderboard query error (expected if no data yet):', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn('Error fetching leaderboard (expected if no data yet):', error);
    return [];
  }
};