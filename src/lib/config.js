// Centralized configuration for ETH Shot
// All hardcoded values should be moved here and made configurable via environment variables

import { fetchETHUSDRate } from './utils/exchange-rate.js';

// Debug environment variables in development and production
if (typeof window !== 'undefined') {
  import('./utils/env-debug.js').then(({ debugEnvironmentVariables }) => {
    debugEnvironmentVariables();
  }).catch(err => console.warn('Failed to load env debug:', err));
}

// Game Configuration
export const GAME_CONFIG = {
  SHOT_COST: parseFloat(import.meta.env.VITE_SHOT_COST_ETH || import.meta.env.PUBLIC_SHOT_COST_ETH || '0.0005'),
  SHOT_COST_ETH: import.meta.env.VITE_SHOT_COST_ETH || import.meta.env.PUBLIC_SHOT_COST_ETH || '0.0005',
  FIRST_SHOT_COST: parseFloat(import.meta.env.VITE_FIRST_SHOT_COST_ETH || import.meta.env.PUBLIC_FIRST_SHOT_COST_ETH || '0.001'),
  FIRST_SHOT_COST_ETH: import.meta.env.VITE_FIRST_SHOT_COST_ETH || import.meta.env.PUBLIC_FIRST_SHOT_COST_ETH || '0.001',
  SPONSOR_COST: parseFloat(import.meta.env.VITE_SPONSOR_COST_ETH || import.meta.env.PUBLIC_SPONSOR_COST_ETH || '0.001'),
  SPONSOR_COST_ETH: import.meta.env.VITE_SPONSOR_COST_ETH || import.meta.env.PUBLIC_SPONSOR_COST_ETH || '0.001',
  WIN_PERCENTAGE: parseFloat(import.meta.env.VITE_WIN_PERCENTAGE || import.meta.env.PUBLIC_WIN_PERCENTAGE || '1'),
  WINNER_PERCENTAGE: parseFloat(import.meta.env.VITE_WINNER_PAYOUT_PERCENTAGE || import.meta.env.PUBLIC_WINNER_PAYOUT_PERCENTAGE || '90'),
  WINNER_PAYOUT_PERCENTAGE: parseFloat(import.meta.env.VITE_WINNER_PAYOUT_PERCENTAGE || import.meta.env.PUBLIC_WINNER_PAYOUT_PERCENTAGE || '90'),
  HOUSE_FEE_PERCENTAGE: parseFloat(import.meta.env.VITE_HOUSE_FEE_PERCENTAGE || import.meta.env.PUBLIC_HOUSE_FEE_PERCENTAGE || '10'),
  COOLDOWN_HOURS: parseInt(import.meta.env.VITE_COOLDOWN_HOURS || import.meta.env.PUBLIC_COOLDOWN_HOURS || '1'),
  COOLDOWN_SECONDS: parseInt(import.meta.env.VITE_COOLDOWN_HOURS || import.meta.env.PUBLIC_COOLDOWN_HOURS || '1') * 3600,
  ETH_USD_PRICE: parseFloat(import.meta.env.VITE_ETH_USD_PRICE || import.meta.env.PUBLIC_ETH_USD_PRICE || '2500'),
  // TATUM_API_KEY removed for security - now handled server-side via /api/exchange-rate
};

// Network Configuration
export const NETWORK_CONFIG = {
  CHAIN_ID: parseInt(import.meta.env.VITE_CHAIN_ID || import.meta.env.PUBLIC_CHAIN_ID || '11155111'),
  RPC_URL: (import.meta.env.VITE_RPC_URL || import.meta.env.PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/demo').trim(),
  NETWORK_NAME: (import.meta.env.VITE_NETWORK_NAME || import.meta.env.PUBLIC_NETWORK_NAME || 'Sepolia Testnet').trim(),
  BLOCK_EXPLORER_URL: (import.meta.env.VITE_BLOCK_EXPLORER_URL || import.meta.env.PUBLIC_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io').trim(),
  CONTRACT_ADDRESS: (import.meta.env.VITE_CONTRACT_ADDRESS || import.meta.env.PUBLIC_CONTRACT_ADDRESS || '').trim(),
};

// Social Media & External URLs
export const SOCIAL_CONFIG = {
  APP_URL: import.meta.env.VITE_APP_URL || import.meta.env.PUBLIC_APP_URL || 'https://ethshot.io',
  TWITTER_URL: import.meta.env.VITE_TWITTER_URL || import.meta.env.PUBLIC_TWITTER_URL || 'https://x.com/profulltackinc',
  GITHUB_URL: import.meta.env.VITE_GITHUB_URL || import.meta.env.PUBLIC_GITHUB_URL || 'https://github.com/profulltack/ethshot-web',
  DISCORD_URL: import.meta.env.VITE_DISCORD_INVITE || import.meta.env.VITE_DISCORD_URL || import.meta.env.PUBLIC_DISCORD_INVITE || import.meta.env.PUBLIC_DISCORD_URL || 'https://discord.gg/profulltack',
};

// Wallet URLs
export const WALLET_URLS = {
  METAMASK: 'https://metamask.io',
  WALLETCONNECT: 'https://walletconnect.com',
  PHANTOM: 'https://phantom.app',
  COINBASE: 'https://www.coinbase.com/wallet',
  TRUST: 'https://trustwallet.com',
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION_MS: parseInt(import.meta.env.VITE_TOAST_DURATION_MS || import.meta.env.PUBLIC_TOAST_DURATION_MS || '5000'),
  ANIMATION_DURATION_MS: parseInt(import.meta.env.VITE_ANIMATION_DURATION_MS || import.meta.env.PUBLIC_ANIMATION_DURATION_MS || '3000'),
  LEADERBOARD_LIMIT: parseInt(import.meta.env.VITE_LEADERBOARD_LIMIT || import.meta.env.PUBLIC_LEADERBOARD_LIMIT || '10'),
  RECENT_WINNERS_LIMIT: parseInt(import.meta.env.VITE_RECENT_WINNERS_LIMIT || import.meta.env.PUBLIC_RECENT_WINNERS_LIMIT || '5'),
};

// Database Configuration
export const DB_CONFIG = {
  TABLES: {
    PLAYERS: import.meta.env.VITE_DB_TABLE_PLAYERS || import.meta.env.PUBLIC_DB_TABLE_PLAYERS || 'players',
    SHOTS: import.meta.env.VITE_DB_TABLE_SHOTS || import.meta.env.PUBLIC_DB_TABLE_SHOTS || 'shots',
    WINNERS: import.meta.env.VITE_DB_TABLE_WINNERS || import.meta.env.PUBLIC_DB_TABLE_WINNERS || 'winners',
    SPONSORS: import.meta.env.VITE_DB_TABLE_SPONSORS || import.meta.env.PUBLIC_DB_TABLE_SPONSORS || 'sponsors',
    GAME_STATS: import.meta.env.VITE_DB_TABLE_GAME_STATS || import.meta.env.PUBLIC_DB_TABLE_GAME_STATS || 'game_stats',
  },
};

// Development/Debug Configuration
export const DEBUG_CONFIG = {
  ENABLE_MOCK_DATA: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true' || import.meta.env.PUBLIC_ENABLE_MOCK_DATA === 'true',
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || import.meta.env.PUBLIC_LOG_LEVEL || 'info',
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS !== 'false' && import.meta.env.PUBLIC_ENABLE_ANALYTICS !== 'false',
};

// Wallet Configuration
export const WALLET_CONFIG = {
  INFURA_PROJECT_ID: import.meta.env.VITE_INFURA_PROJECT_ID || import.meta.env.PUBLIC_INFURA_PROJECT_ID || 'demo',
  WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || import.meta.env.PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  WALLETCONNECT_THEME: import.meta.env.VITE_WALLETCONNECT_THEME || import.meta.env.PUBLIC_WALLETCONNECT_THEME || 'dark',
  WALLETCONNECT_CACHE_PROVIDER: import.meta.env.VITE_WALLETCONNECT_CACHE_PROVIDER !== 'false' && import.meta.env.PUBLIC_WALLETCONNECT_CACHE_PROVIDER !== 'false',
};

// Network RPC URLs
export const RPC_URLS = {
  MAINNET: import.meta.env.VITE_MAINNET_RPC_URL || import.meta.env.PUBLIC_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/demo',
  SEPOLIA: import.meta.env.VITE_SEPOLIA_RPC_URL || import.meta.env.PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/demo',
  BASE: import.meta.env.VITE_BASE_RPC_URL || import.meta.env.PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  ARBITRUM: import.meta.env.VITE_ARBITRUM_RPC_URL || import.meta.env.PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
};

// Block Explorer URLs
export const EXPLORER_URLS = {
  MAINNET: import.meta.env.VITE_MAINNET_EXPLORER_URL || import.meta.env.PUBLIC_MAINNET_EXPLORER_URL || 'https://etherscan.io',
  SEPOLIA: import.meta.env.VITE_BLOCK_EXPLORER_URL || import.meta.env.PUBLIC_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io',
  BASE: import.meta.env.VITE_BASE_EXPLORER_URL || import.meta.env.PUBLIC_BASE_EXPLORER_URL || 'https://basescan.org',
  ARBITRUM: import.meta.env.VITE_ARBITRUM_EXPLORER_URL || import.meta.env.PUBLIC_ARBITRUM_EXPLORER_URL || 'https://arbiscan.io',
};

// Validation function to check required configuration
export const validateConfig = () => {
  const required = [
    { vite: 'VITE_CONTRACT_ADDRESS', public: 'PUBLIC_CONTRACT_ADDRESS' },
    { vite: 'VITE_SUPABASE_URL', public: 'PUBLIC_SUPABASE_URL' },
    { vite: 'VITE_SUPABASE_ANON_KEY', public: 'PUBLIC_SUPABASE_ANON_KEY' }
  ];
  
  const missing = required.filter(({ vite, public: pub }) =>
    !import.meta.env[vite] && !import.meta.env[pub]
  ).map(({ vite, public: pub }) => `${vite} or ${pub}`);
  
  if (missing.length > 0) {
    console.warn(`Missing recommended environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
};

// Helper functions for common calculations
export const calculateUSDValue = async (ethAmount) => {
  try {
    const currentRate = await fetchETHUSDRate();
    return (parseFloat(ethAmount) * currentRate).toFixed(2);
  } catch (error) {
    console.warn('Failed to fetch current ETH/USD rate, using fallback:', error);
    // Fallback to configured rate if API fails
    return (parseFloat(ethAmount) * GAME_CONFIG.ETH_USD_PRICE).toFixed(2);
  }
};

// Synchronous version for backward compatibility (uses cached rate if available)
export const calculateUSDValueSync = (ethAmount) => {
  return (parseFloat(ethAmount) * GAME_CONFIG.ETH_USD_PRICE).toFixed(2);
};

export const formatEth = (amount) => {
  // Use 5 decimal places for consistent precision
  const num = parseFloat(amount);
  return num.toFixed(5);
};

export const formatTime = (seconds) => {
  if (seconds <= 0) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${secs}s`;
  }
};

export const formatCooldownTime = (hours) => {
  if (hours === 1) return '1 hour';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  return `${hours} hours`;
};

export const getWinnerPayoutAmount = (potAmount) => {
  return (parseFloat(potAmount) * (GAME_CONFIG.WINNER_PAYOUT_PERCENTAGE / 100)).toFixed(3);
};

export const getHouseFeeAmount = (potAmount) => {
  return (parseFloat(potAmount) * (GAME_CONFIG.HOUSE_FEE_PERCENTAGE / 100)).toFixed(3);
};