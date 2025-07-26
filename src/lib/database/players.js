/**
 * Players Database Operations
 * 
 * Handles all player-related database operations
 */

import { supabase, TABLES } from './client.js';

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
};