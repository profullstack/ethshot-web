/**
 * Test suite for the unified multi-crypto game store
 * 
 * Tests both ETH-only mode and multi-crypto mode functionality
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { get } from 'svelte/store';

// Mock browser environment
global.browser = true;

// Mock the stores and dependencies
const mockWalletStore = {
  subscribe: () => () => {},
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  signer: {},
  provider: {}
};

const mockMultiCryptoWalletStore = {
  subscribe: () => () => {},
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  activeCrypto: 'ETH'
};

const mockToastStore = {
  error: () => {},
  info: () => {},
  success: () => {}
};

const mockDb = {
  getRecentWinners: async () => [],
  getGameStats: async () => ({}),
  getCurrentSponsor: async () => null,
  getTopPlayers: async () => [],
  getPlayer: async () => null,
  recordShot: async () => ({ id: 'test-shot' }),
  recordWinner: async () => ({ id: 'test-winner' }),
  upsertPlayer: async () => ({ address: 'test-address' }),
  recordSponsor: async () => ({ id: 'test-sponsor' }),
  subscribeToWinners: () => ({ unsubscribe: () => {} }),
  subscribeToShots: () => ({ unsubscribe: () => {} }),
  subscribeToSponsors: () => ({ unsubscribe: () => {} })
};

const mockAdapter = {
  getShotCost: async () => '0.001',
  getSponsorCost: async () => '0.05',
  getContractBalance: async () => '1.0',
  getHouseFunds: async () => '0.1',
  getCurrentPot: async () => '0.9',
  getCurrentSponsor: async () => ({ active: false }),
  getRecentWinners: async () => [],
  getPlayerStats: async () => ({
    totalShots: 5,
    totalSpent: '0.005',
    totalWon: '0.0',
    lastShotTime: new Date().toISOString()
  }),
  canTakeShot: async () => true,
  getCooldownRemaining: async () => 0,
  takeShot: async () => ({
    hash: '0xtest',
    receipt: { blockNumber: 12345 },
    won: false
  }),
  sponsorRound: async () => ({
    hash: '0xtest',
    receipt: { blockNumber: 12345 }
  }),
  config: {
    contractConfig: {
      address: '0xtest'
    }
  }
};

const mockEthers = {
  JsonRpcProvider: class {
    async getNetwork() { return {}; }
  },
  Contract: class {
    constructor() {
      this.SHOT_COST = async () => BigInt('1000000000000000'); // 0.001 ETH in wei
      this.SPONSOR_COST = async () => BigInt('50000000000000000'); // 0.05 ETH in wei
      this.getContractBalance = async () => BigInt('1000000000000000000'); // 1 ETH in wei
      this.getHouseFunds = async () => BigInt('100000000000000000'); // 0.1 ETH in wei
      this.getCurrentPot = async () => BigInt('900000000000000000'); // 0.9 ETH in wei
      this.getCurrentSponsor = async () => ({ active: false });
      this.getRecentWinners = async () => [];
      this.getPlayerStats = async () => ({
        totalShots: BigInt(5),
        totalSpent: BigInt('5000000000000000'), // 0.005 ETH in wei
        totalWon: BigInt(0),
        lastShotTime: BigInt(Math.floor(Date.now() / 1000))
      });
      this.canTakeShot = async () => true;
      this.getCooldownRemaining = async () => BigInt(0);
      this.connect = () => this;
      this.takeShot = {
        estimateGas: async () => BigInt(150000)
      };
      this.sponsorRound = {
        estimateGas: async () => BigInt(100000)
      };
      this.interface = {
        parseLog: () => ({ name: 'ShotTaken', args: { won: false } })
      };
    }
  },
  formatEther: (value) => (Number(value) / 1e18).toString(),
  parseEther: (value) => BigInt(Math.floor(parseFloat(value) * 1e18))
};

// Mock modules
const mocks = {
  'svelte/store': { writable: () => ({ subscribe: () => {}, set: () => {}, update: () => {} }), derived: () => ({ subscribe: () => {} }), get: () => ({}) },
  '$app/environment': { browser: true },
  './wallet-multi-crypto.js': { multiCryptoWalletStore: mockMultiCryptoWalletStore },
  './wallet.js': { walletStore: mockWalletStore },
  './toast.js': { toastStore: mockToastStore },
  '../supabase.js': { db: mockDb, formatAddress: (addr) => addr, formatEther: (val) => val, formatTimeAgo: (date) => date },
  '../crypto/adapters/index.js': { getActiveAdapter: () => mockAdapter },
  '../crypto/config.js': { 
    getCryptoGameConfig: () => ({ shotCost: '0.001' }),
    getCurrentCrypto: () => ({ type: 'ETH' })
  },
  '../config.js': { 
    GAME_CONFIG: { SHOT_COST_ETH: '0.001' },
    NETWORK_CONFIG: { CONTRACT_ADDRESS: '0xtest', RPC_URL: 'http://test' },
    SOCIAL_CONFIG: { APP_URL: 'https://test.com' },
    UI_CONFIG: {},
    calculateUSDValue: async (eth) => (parseFloat(eth) * 2500).toFixed(2)
  },
  '../utils/external-links.js': { shareOnTwitter: () => {} },
  '../utils/notifications.js': {
    notificationManager: { requestPermission: () => {}, getPermissionStatus: () => 'granted', isEnabled: () => true },
    notifyJackpotWon: () => {},
    notifyShotTaken: () => {},
    notifyPotMilestone: () => {},
    scheduleCooldownNotification: () => {}
  },
  'ethers': mockEthers
};

describe('Unified Game Store', () => {
  let gameStore;
  let originalImport;

  beforeEach(async () => {
    // Mock dynamic imports
    originalImport = global.import;
    global.import = async (module) => {
      if (mocks[module]) {
        return mocks[module];
      }
      return originalImport(module);
    };

    // Import the store after mocking
    const storeModule = await import('../../src/lib/stores/game-unified.js');
    gameStore = storeModule.gameStore;
  });

  afterEach(() => {
    global.import = originalImport;
  });

  describe('Store Initialization', () => {
    it('should initialize with default state', () => {
      const state = get(gameStore);
      
      expect(state).to.have.property('currentPot', '0');
      expect(state).to.have.property('activeCrypto', 'ETH');
      expect(state).to.have.property('isMultiCryptoMode', false);
      expect(state).to.have.property('loading', false);
      expect(state).to.have.property('contractDeployed', null);
    });

    it('should have all required methods', () => {
      expect(gameStore).to.have.property('init');
      expect(gameStore).to.have.property('switchCrypto');
      expect(gameStore).to.have.property('loadGameState');
      expect(gameStore).to.have.property('loadPlayerData');
      expect(gameStore).to.have.property('takeShot');
      expect(gameStore).to.have.property('sponsorRound');
      expect(gameStore).to.have.property('shareOnTwitter');
      expect(gameStore).to.have.property('copyLink');
      expect(gameStore).to.have.property('formatTimeRemaining');
      expect(gameStore).to.have.property('stopRealTimeUpdates');
    });
  });

  describe('ETH-only Mode', () => {
    it('should initialize in ETH-only mode by default', async () => {
      await gameStore.init();
      const state = get(gameStore);
      
      expect(state.activeCrypto).to.equal('ETH');
      expect(state.isMultiCryptoMode).to.be.false;
    });

    it('should handle contract deployment check', async () => {
      await gameStore.init();
      const state = get(gameStore);
      
      // Should attempt to check contract deployment
      expect(state.contractDeployed).to.not.be.null;
    });
  });

  describe('Multi-crypto Mode', () => {
    it('should initialize in multi-crypto mode when specified', async () => {
      await gameStore.init('ETH', true);
      const state = get(gameStore);
      
      expect(state.activeCrypto).to.equal('ETH');
      expect(state.isMultiCryptoMode).to.be.true;
    });

    it('should support switching cryptocurrencies', async () => {
      await gameStore.init('ETH', true);
      await gameStore.switchCrypto('BTC');
      
      const state = get(gameStore);
      expect(state.activeCrypto).to.equal('BTC');
    });
  });

  describe('Game State Management', () => {
    it('should load game state successfully', async () => {
      await gameStore.init();
      await gameStore.loadGameState();
      
      const state = get(gameStore);
      expect(state.lastUpdate).to.not.be.null;
    });

    it('should load player data successfully', async () => {
      await gameStore.init();
      await gameStore.loadPlayerData('0x1234567890123456789012345678901234567890');
      
      const state = get(gameStore);
      expect(state.playerStats).to.not.be.null;
    });
  });

  describe('USD Value Integration', () => {
    it('should calculate USD values for pot and costs', async () => {
      await gameStore.init();
      await gameStore.loadGameState();
      
      const state = get(gameStore);
      
      // Should have USD values calculated
      expect(state).to.have.property('currentPotUSD');
      expect(state).to.have.property('shotCostUSD');
      expect(state).to.have.property('sponsorCostUSD');
    });
  });

  describe('Utility Functions', () => {
    it('should format time remaining correctly', () => {
      expect(gameStore.formatTimeRemaining(0)).to.equal('0s');
      expect(gameStore.formatTimeRemaining(30)).to.equal('30s');
      expect(gameStore.formatTimeRemaining(90)).to.equal('1m 30s');
      expect(gameStore.formatTimeRemaining(3661)).to.equal('1h 1m');
    });
  });

  describe('Derived Stores', () => {
    it('should export all required derived stores', async () => {
      const storeModule = await import('../../src/lib/stores/game-unified.js');
      
      expect(storeModule).to.have.property('currentPot');
      expect(storeModule).to.have.property('currentPotUSD');
      expect(storeModule).to.have.property('canTakeShot');
      expect(storeModule).to.have.property('cooldownRemaining');
      expect(storeModule).to.have.property('isLoading');
      expect(storeModule).to.have.property('currentSponsor');
      expect(storeModule).to.have.property('recentWinners');
      expect(storeModule).to.have.property('playerStats');
      expect(storeModule).to.have.property('contractDeployed');
      expect(storeModule).to.have.property('gameError');
      expect(storeModule).to.have.property('activeCrypto');
      expect(storeModule).to.have.property('gameConfig');
      expect(storeModule).to.have.property('shotCost');
      expect(storeModule).to.have.property('shotCostUSD');
      expect(storeModule).to.have.property('sponsorCost');
      expect(storeModule).to.have.property('sponsorCostUSD');
      expect(storeModule).to.have.property('isMultiCryptoMode');
    });

    it('should provide backward compatibility exports', async () => {
      const storeModule = await import('../../src/lib/stores/game-unified.js');
      
      expect(storeModule).to.have.property('multiCryptoGameStore');
      expect(storeModule.multiCryptoGameStore).to.equal(storeModule.gameStore);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock a failing adapter
      mocks['../crypto/adapters/index.js'].getActiveAdapter = () => null;
      
      await gameStore.init('INVALID', true);
      const state = get(gameStore);
      
      expect(state.error).to.not.be.null;
      expect(state.loading).to.be.false;
    });

    it('should handle contract deployment failures', async () => {
      // Mock failing contract calls
      mockEthers.Contract = class {
        constructor() {
          this.SHOT_COST = async () => { throw new Error('Contract not deployed'); };
        }
      };
      
      await gameStore.init();
      const state = get(gameStore);
      
      expect(state.contractDeployed).to.be.false;
      expect(state.error).to.not.be.null;
    });
  });

  describe('Cache Management', () => {
    it('should use caching to reduce RPC calls', async () => {
      await gameStore.init();
      
      // First call should populate cache
      await gameStore.loadGameState();
      
      // Second call should use cache
      await gameStore.loadGameState();
      
      // Should complete without errors
      const state = get(gameStore);
      expect(state.error).to.be.null;
    });
  });
});