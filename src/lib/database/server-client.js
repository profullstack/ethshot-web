/**
 * Server-side Supabase Client Configuration
 *
 * This client uses the service role key for server-side operations
 * that need to bypass Row Level Security (RLS) policies.
 *
 * IMPORTANT: This should ONLY be used on the server-side!
 */

import { createClient } from '@supabase/supabase-js';
import { SERVER_CONFIG, isServerConfigured } from '../config-server.js';

// Create server-side Supabase client with service role key
export const supabaseServer = isServerConfigured()
  ? createClient(SERVER_CONFIG.SUPABASE_URL, SERVER_CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Service role bypasses RLS
      db: {
        schema: 'public',
      },
    })
  : null;

/**
 * Check if server-side Supabase is configured and available
 * @returns {boolean} True if server-side Supabase is available
 */
export const isSupabaseServerAvailable = () => {
  return isServerConfigured() && supabaseServer !== null;
};

/**
 * Get server-side Supabase client instance
 * @returns {Object|null} Server-side Supabase client or null if not configured
 */
export const getSupabaseServerClient = () => {
  if (!isServerConfigured()) {
    throw new Error(`Server-side Supabase client is not configured. Missing environment variables: ${SERVER_CONFIG.missingVariables.join(', ')}`);
  }
  if (!supabaseServer) {
    throw new Error('Server-side Supabase client failed to initialize despite having required environment variables.');
  }
  return supabaseServer;
};

// Database table names (same as client-side)
export const TABLES = {
  USERS: 'users',
  PLAYERS: 'players',
  SHOTS: 'shots',
  WINNERS: 'winners',
  SPONSORS: 'sponsors',
  GAME_STATS: 'game_stats',
  LEADERBOARD: 'leaderboard',
  REFERRAL_CODES: 'referral_codes',
  REFERRALS: 'referrals',
  REFERRAL_DISCOUNTS: 'referral_discounts',
  USER_PROFILES: 'user_profiles',
};