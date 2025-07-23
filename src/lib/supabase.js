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
        timestamp: shotData.timestamp || new Date().toISOString()
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