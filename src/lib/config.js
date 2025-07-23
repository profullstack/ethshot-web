// Centralized configuration for ETH Shot
// All hardcoded values should be moved here and made configurable via environment variables

// Game Configuration
export const GAME_CONFIG = {
  SHOT_COST: parseFloat(import.meta.env.PUBLIC_SHOT_COST_ETH || '0.001'),
  SHOT_COST_ETH: import.meta.env.PUBLIC_SHOT_COST_ETH || '0.001',
  SPONSOR_COST_ETH: import.meta.env.PUBLIC_SPONSOR_COST_ETH || '0.05',
  WIN_PERCENTAGE: parseFloat(import.meta.env.PUBLIC_WIN_PERCENTAGE || '1'),
  WINNER_PERCENTAGE: parseFloat(import.meta.env.PUBLIC_WINNER_PAYOUT_PERCENTAGE || '90'),
  WINNER_PAYOUT_PERCENTAGE: parseFloat(import.meta.env.PUBLIC_WINNER_PAYOUT_PERCENTAGE || '90'),
  HOUSE_FEE_PERCENTAGE: parseFloat(import.meta.env.PUBLIC_HOUSE_FEE_PERCENTAGE || '10'),
  COOLDOWN_HOURS: parseInt(import.meta.env.PUBLIC_COOLDOWN_HOURS || '1'),
  COOLDOWN_SECONDS: parseInt(import.meta.env.PUBLIC_COOLDOWN_HOURS || '1') * 3600,
  ETH_USD_PRICE: parseFloat(import.meta.env.PUBLIC_ETH_USD_PRICE || '2500'),
};

// Network Configuration
export const NETWORK_CONFIG = {
  CHAIN_ID: parseInt(import.meta.env.PUBLIC_CHAIN_ID || '11155111'),
  RPC_URL: import.meta.env.PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/demo',
  NETWORK_NAME: import.meta.env.PUBLIC_NETWORK_NAME || 'Sepolia Testnet',
  BLOCK_EXPLORER_URL: import.meta.env.PUBLIC_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io',
  CONTRACT_ADDRESS: import.meta.env.PUBLIC_CONTRACT_ADDRESS || '',
};

// Social Media & External URLs
export const SOCIAL_CONFIG = {
  APP_URL: import.meta.env.PUBLIC_APP_URL || 'https://ethshot.io',
  TWITTER_URL: import.meta.env.PUBLIC_TWITTER_URL || 'https://twitter.com/ethshot',
  GITHUB_URL: import.meta.env.PUBLIC_GITHUB_URL || 'https://github.com/ethshot/ethshot-web',
  DISCORD_URL: import.meta.env.PUBLIC_DISCORD_URL || 'https://discord.gg/ethshot',
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION_MS: parseInt(import.meta.env.PUBLIC_TOAST_DURATION_MS || '5000'),
  ANIMATION_DURATION_MS: parseInt(import.meta.env.PUBLIC_ANIMATION_DURATION_MS || '3000'),
  LEADERBOARD_LIMIT: parseInt(import.meta.env.PUBLIC_LEADERBOARD_LIMIT || '10'),
  RECENT_WINNERS_LIMIT: parseInt(import.meta.env.PUBLIC_RECENT_WINNERS_LIMIT || '5'),
};

// Database Configuration
export const DB_CONFIG = {
  TABLES: {
    PLAYERS: import.meta.env.PUBLIC_DB_TABLE_PLAYERS || 'players',
    SHOTS: import.meta.env.PUBLIC_DB_TABLE_SHOTS || 'shots',
    WINNERS: import.meta.env.PUBLIC_DB_TABLE_WINNERS || 'winners',
    SPONSORS: import.meta.env.PUBLIC_DB_TABLE_SPONSORS || 'sponsors',
    GAME_STATS: import.meta.env.PUBLIC_DB_TABLE_GAME_STATS || 'game_stats',
  },
};

// Development/Debug Configuration
export const DEBUG_CONFIG = {
  ENABLE_MOCK_DATA: import.meta.env.PUBLIC_ENABLE_MOCK_DATA === 'true',
  LOG_LEVEL: import.meta.env.PUBLIC_LOG_LEVEL || 'info',
  ENABLE_ANALYTICS: import.meta.env.PUBLIC_ENABLE_ANALYTICS !== 'false',
};

// Wallet Configuration
export const WALLET_CONFIG = {
  INFURA_PROJECT_ID: import.meta.env.PUBLIC_INFURA_PROJECT_ID || 'demo',
  WALLETCONNECT_THEME: import.meta.env.PUBLIC_WALLETCONNECT_THEME || 'dark',
  WALLETCONNECT_CACHE_PROVIDER: import.meta.env.PUBLIC_WALLETCONNECT_CACHE_PROVIDER !== 'false',
};

// Network RPC URLs
export const RPC_URLS = {
  MAINNET: import.meta.env.PUBLIC_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/demo',
  SEPOLIA: import.meta.env.PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/demo',
  BASE: import.meta.env.PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  ARBITRUM: import.meta.env.PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
};

// Block Explorer URLs
export const EXPLORER_URLS = {
  MAINNET: import.meta.env.PUBLIC_MAINNET_EXPLORER_URL || 'https://etherscan.io',
  SEPOLIA: import.meta.env.PUBLIC_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io',
  BASE: import.meta.env.PUBLIC_BASE_EXPLORER_URL || 'https://basescan.org',
  ARBITRUM: import.meta.env.PUBLIC_ARBITRUM_EXPLORER_URL || 'https://arbiscan.io',
};

// Validation function to check required configuration
export const validateConfig = () => {
  const required = [
    'PUBLIC_CONTRACT_ADDRESS',
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing recommended environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
};

// Helper functions for common calculations
export const calculateUSDValue = (ethAmount) => {
  return (parseFloat(ethAmount) * GAME_CONFIG.ETH_USD_PRICE).toLocaleString();
};

export const formatEth = (amount) => {
  return parseFloat(amount).toFixed(3);
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