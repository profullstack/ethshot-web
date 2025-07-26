// Multi-cryptocurrency configuration system
// Supports ETH, SOL, and future cryptocurrencies

/**
 * Supported cryptocurrency types
 */
export const CRYPTO_TYPES = {
  ETH: 'ETH',
  SOL: 'SOL'
};

/**
 * Blockchain network types
 */
export const NETWORK_TYPES = {
  ETHEREUM: 'ethereum',
  SOLANA: 'solana'
};

/**
 * Wallet provider types
 */
export const WALLET_PROVIDERS = {
  // Ethereum wallets
  METAMASK: 'metamask',
  WALLETCONNECT: 'walletconnect',
  COINBASE: 'coinbase',
  TRUST: 'trust',
  
  // Solana wallets
  PHANTOM: 'phantom',
  SOLFLARE: 'solflare',
  BACKPACK: 'backpack',
  
  // Multi-chain wallets
  INJECTED: 'injected'
};

/**
 * Base cryptocurrency configuration interface
 */
const createCryptoConfig = ({
  type,
  name,
  symbol,
  decimals,
  networkType,
  defaultNetwork,
  networks,
  walletProviders,
  contractConfig,
  formatters,
  validators
}) => ({
  type,
  name,
  symbol,
  decimals,
  networkType,
  defaultNetwork,
  networks,
  walletProviders,
  contractConfig,
  formatters,
  validators
});

/**
 * Ethereum configuration
 */
export const ETH_CONFIG = createCryptoConfig({
  type: CRYPTO_TYPES.ETH,
  name: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
  networkType: NETWORK_TYPES.ETHEREUM,
  defaultNetwork: 'sepolia',
  
  networks: {
    mainnet: {
      chainId: 1,
      chainIdHex: '0x1',
      name: 'Ethereum Mainnet',
      rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/demo',
      explorerUrl: 'https://etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    },
    sepolia: {
      chainId: 11155111,
      chainIdHex: '0xaa36a7',
      name: 'Sepolia Testnet',
      rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/demo',
      explorerUrl: 'https://sepolia.etherscan.io',
      nativeCurrency: {
        name: 'Sepolia Ether',
        symbol: 'SEP',
        decimals: 18
      }
    },
    base: {
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpcUrl: import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
      explorerUrl: 'https://basescan.org',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    },
    arbitrum: {
      chainId: 42161,
      chainIdHex: '0xa4b1',
      name: 'Arbitrum One',
      rpcUrl: import.meta.env.VITE_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      explorerUrl: 'https://arbiscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      }
    }
  },
  
  walletProviders: [
    WALLET_PROVIDERS.METAMASK,
    WALLET_PROVIDERS.WALLETCONNECT,
    WALLET_PROVIDERS.COINBASE,
    WALLET_PROVIDERS.TRUST,
    WALLET_PROVIDERS.INJECTED
  ],
  
  contractConfig: {
    abi: [
      'function commitShot(bytes32 commitment) external payable',
      'function revealShot(uint256 secret) external',
      'function sponsorRound(string calldata name, string calldata logoUrl) external payable',
      'function getCurrentPot() external view returns (uint256)',
      'function getContractBalance() external view returns (uint256)',
      'function getHouseFunds() external view returns (uint256)',
      'function getPlayerStats(address player) external view returns (tuple(uint256 totalShots, uint256 totalSpent, uint256 totalWon, uint256 lastShotTime))',
      'function canCommitShot(address player) external view returns (bool)',
      'function canRevealShot(address player) external view returns (bool)',
      'function hasPendingShot(address player) external view returns (bool)',
      'function getPendingShot(address player) external view returns (bool exists, uint256 blockNumber, uint256 amount)',
      'function getPendingPayout(address player) external view returns (uint256)',
      'function getCooldownRemaining(address player) external view returns (uint256)',
      'function claimPayout() external',
      'function getCurrentSponsor() external view returns (tuple(address sponsor, string name, string logoUrl, uint256 timestamp, bool active))',
      'function getRecentWinners() external view returns (tuple(address winner, uint256 amount, uint256 timestamp, uint256 blockNumber)[])',
      'function SHOT_COST() external view returns (uint256)',
      'function SPONSOR_COST() external view returns (uint256)',
      'event ShotCommitted(address indexed player, bytes32 indexed commitment, uint256 amount)',
      'event ShotRevealed(address indexed player, uint256 indexed amount, bool indexed won)',
      'event JackpotWon(address indexed winner, uint256 indexed amount, uint256 indexed timestamp)',
      'event SponsorshipActivated(address indexed sponsor, string name, string logoUrl)',
      'event PayoutFailed(address indexed player, uint256 amount)',
      'event PayoutClaimed(address indexed player, uint256 amount)'
    ],
    address: import.meta.env.VITE_ETH_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT_ADDRESS || '',
    deploymentBlock: 0
  },
  
  formatters: {
    formatAmount: (amount, precision = 4) => {
      const num = parseFloat(amount);
      if (num < 0.001 && num > 0) {
        return num.toFixed(precision);
      }
      return num.toFixed(3);
    },
    
    formatAddress: (address) => {
      if (!address) return '';
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    
    parseAmount: (amount) => {
      // Will be implemented with ethers.parseEther
      return amount;
    },
    
    formatUnits: (amount) => {
      // Will be implemented with ethers.formatEther
      return amount;
    }
  },
  
  validators: {
    isValidAddress: (address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    },
    
    isValidAmount: (amount) => {
      return !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    }
  }
});

/**
 * Solana configuration (prepared for future implementation)
 */
export const SOL_CONFIG = createCryptoConfig({
  type: CRYPTO_TYPES.SOL,
  name: 'Solana',
  symbol: 'SOL',
  decimals: 9,
  networkType: NETWORK_TYPES.SOLANA,
  defaultNetwork: 'devnet',
  
  networks: {
    mainnet: {
      name: 'Solana Mainnet',
      rpcUrl: import.meta.env.VITE_SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
      explorerUrl: 'https://explorer.solana.com',
      cluster: 'mainnet-beta'
    },
    devnet: {
      name: 'Solana Devnet',
      rpcUrl: import.meta.env.VITE_SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
      explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
      cluster: 'devnet'
    },
    testnet: {
      name: 'Solana Testnet',
      rpcUrl: import.meta.env.VITE_SOLANA_TESTNET_RPC_URL || 'https://api.testnet.solana.com',
      explorerUrl: 'https://explorer.solana.com/?cluster=testnet',
      cluster: 'testnet'
    }
  },
  
  walletProviders: [
    WALLET_PROVIDERS.PHANTOM,
    WALLET_PROVIDERS.SOLFLARE,
    WALLET_PROVIDERS.BACKPACK
  ],
  
  contractConfig: {
    // Solana program configuration will be added when implementing SOL support
    programId: import.meta.env.VITE_SOL_PROGRAM_ID || '',
    idl: null // Program IDL will be defined later
  },
  
  formatters: {
    formatAmount: (amount, precision = 4) => {
      const num = parseFloat(amount);
      if (num < 0.001 && num > 0) {
        return num.toFixed(precision);
      }
      return num.toFixed(3);
    },
    
    formatAddress: (address) => {
      if (!address) return '';
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    },
    
    parseAmount: (amount) => {
      // Will be implemented with Solana web3.js
      return amount;
    },
    
    formatUnits: (amount) => {
      // Will be implemented with Solana web3.js
      return amount;
    }
  },
  
  validators: {
    isValidAddress: (address) => {
      // Solana addresses are base58 encoded and 32-44 characters
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    },
    
    isValidAmount: (amount) => {
      return !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    }
  }
});

/**
 * Registry of all supported cryptocurrencies
 */
export const CRYPTO_REGISTRY = {
  [CRYPTO_TYPES.ETH]: ETH_CONFIG,
  [CRYPTO_TYPES.SOL]: SOL_CONFIG
};

/**
 * Get cryptocurrency configuration by type
 */
export const getCryptoConfig = (cryptoType) => {
  const config = CRYPTO_REGISTRY[cryptoType];
  if (!config) {
    throw new Error(`Unsupported cryptocurrency type: ${cryptoType}`);
  }
  return config;
};

/**
 * Get current active cryptocurrency (defaults to ETH for now)
 */
export const getCurrentCrypto = () => {
  const activeCrypto = import.meta.env.VITE_ACTIVE_CRYPTO || CRYPTO_TYPES.ETH;
  return getCryptoConfig(activeCrypto);
};

/**
 * Get all supported cryptocurrencies
 */
export const getSupportedCryptos = () => {
  return Object.values(CRYPTO_REGISTRY);
};

/**
 * Check if a cryptocurrency is supported
 */
export const isCryptoSupported = (cryptoType) => {
  return cryptoType in CRYPTO_REGISTRY;
};

/**
 * Game configuration per cryptocurrency
 */
export const CRYPTO_GAME_CONFIG = {
  [CRYPTO_TYPES.ETH]: {
    shotCost: import.meta.env.VITE_ETH_SHOT_COST || '0.001',
    sponsorCost: import.meta.env.VITE_ETH_SPONSOR_COST || '0.05',
    winPercentage: parseFloat(import.meta.env.VITE_ETH_WIN_PERCENTAGE || '90'),
    housePercentage: parseFloat(import.meta.env.VITE_ETH_HOUSE_PERCENTAGE || '10'),
    cooldownHours: parseInt(import.meta.env.VITE_ETH_COOLDOWN_HOURS || '1'),
    usdPrice: parseFloat(import.meta.env.VITE_ETH_USD_PRICE || '2500')
  },
  [CRYPTO_TYPES.SOL]: {
    shotCost: import.meta.env.VITE_SOL_SHOT_COST || '0.01',
    sponsorCost: import.meta.env.VITE_SOL_SPONSOR_COST || '0.5',
    winPercentage: parseFloat(import.meta.env.VITE_SOL_WIN_PERCENTAGE || '90'),
    housePercentage: parseFloat(import.meta.env.VITE_SOL_HOUSE_PERCENTAGE || '10'),
    cooldownHours: parseInt(import.meta.env.VITE_SOL_COOLDOWN_HOURS || '1'),
    usdPrice: parseFloat(import.meta.env.VITE_SOL_USD_PRICE || '100')
  }
};

/**
 * Get game configuration for a specific cryptocurrency
 */
export const getCryptoGameConfig = (cryptoType) => {
  const config = CRYPTO_GAME_CONFIG[cryptoType];
  if (!config) {
    throw new Error(`No game configuration found for cryptocurrency: ${cryptoType}`);
  }
  return config;
};