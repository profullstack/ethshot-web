/**
 * Supabase Client Configuration
 * 
 * Handles Supabase client setup and configuration
 */

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
        // Disable realtime since we use our own chat server
        enabled: false,
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
  USER_PROFILES: 'user_profiles',
};

/**
 * Check if Supabase is configured and available
 * @returns {boolean} True if Supabase is available
 */
export const isSupabaseAvailable = () => {
  return supabase !== null;
};

/**
 * Get Supabase client instance
 * @returns {Object|null} Supabase client or null if not configured
 */
export const getSupabaseClient = () => {
  return supabase;
};