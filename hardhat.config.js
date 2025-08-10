import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const {
  MAINNET_RPC_URL,
  SEPOLIA_RPC_URL,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
  BASESCAN_API_KEY,
  ARBISCAN_API_KEY,
  // Frontend RPC fallbacks so you don't need to duplicate env vars
  VITE_ETH_RPC_URL,
  VITE_RPC_URL,
} = process.env;

// Resolve RPC URLs with sane fallbacks.
// Note: If you use VITE_* URLs, ensure they actually point to the intended network.
const resolvedMainnetUrl =
  MAINNET_RPC_URL || VITE_ETH_RPC_URL || VITE_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';

const resolvedSepoliaUrl =
  SEPOLIA_RPC_URL || VITE_ETH_RPC_URL || VITE_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';

// Diagnostics (masked) to help catch placeholder or malformed RPC values
const maskUrl = (u) => {
  if (!u) return String(u);
  try {
    const shown = u.slice(0, 24);
    const tail = u.slice(-6);
    return `${shown}…${tail}`;
  } catch {
    return '***';
  }
};

const warnUrl = (name, u) => {
  if (!u) {
    console.warn(`[hardhat] ${name} RPC URL is empty or undefined`);
    return;
  }
  if (u.includes('YOUR_INFURA_KEY')) {
    console.error(`[hardhat] ${name} RPC URL contains placeholder "YOUR_INFURA_KEY" — set a real project id`);
  }
  if (/^wss:/i.test(u)) {
    console.error(`[hardhat] ${name} RPC URL uses WSS; Hardhat HTTP provider requires HTTPS URL`);
  }
  if (/["']/.test(u)) {
    console.error(
      `[hardhat] ${name} RPC URL appears to include quotes — remove quotes in .env (e.g., MAINNET_RPC_URL=https://...)`
    );
  }
};

// Always print masked endpoints so we can verify which variable Hardhat resolved
console.log(`[hardhat] mainnet RPC -> ${maskUrl(resolvedMainnetUrl)}`);
console.log(`[hardhat] sepolia RPC -> ${maskUrl(resolvedSepoliaUrl)}`);
warnUrl('mainnet', resolvedMainnetUrl);
warnUrl('sepolia', resolvedSepoliaUrl);

const config = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    sepolia: {
      url: resolvedSepoliaUrl,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    mainnet: {
      url: resolvedMainnetUrl,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 1,
    },
    base: {
      url: 'https://mainnet.base.org',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 8453,
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 42161,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      base: BASESCAN_API_KEY,
      arbitrumOne: ARBISCAN_API_KEY,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test/contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;