/**
 * Integration tests for the commit-reveal flow
 * Tests full user flow for regular shots, bonus shots, and discount shots
 */

import { describe, it, before, afterEach, after } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { get } from 'svelte/store';

// Mock browser environment
global.browser = true;
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Import stores and utilities
const mockWalletStore = {
  subscribe: () => () => {},
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  signer: {
    getAddress: async () => '0x1234567890123456789012345678901234567890'
  },
  provider: {
    getBlock: async () => ({ number: 100 })
  }
};

const mockDbData = {
  players: [{ address: '0x1234567890123456789012345678901234567890', shots_taken: 5, wins: 0 }],
  shots: [],
  winners: [],
  discounts: [{ id: 'discount-123', percentage: 20, used: false, expires_at: new Date(Date.now() + 86400000) }],
  pendingShots: []
};

// Mock database
const mockDb = {
  getRecentWinners: async () => [],
  getGameStats: async () => ({ total_shots: 100, total_wins: 1 }),
  getCurrentSponsor: async () => null,
  getTopPlayers: async () => [],
  getPlayer: async () => mockDbData.players[0],
  recordShotCommit: async (data) => {
    const shot = { 
      id: 'shot-' + Date.now(), 
      address: data.address, 
      commitment_hash: data.commitment_hash,
      secret: data.secret,
      status: 'committed',
      useBonus: data.useBonus,
      discountId: data.discountId,
      timestamp: new Date(),
      commit_tx_hash: data.txHash,
      commit_block: data.blockNumber
    };
    mockDbData.pendingShots.push(shot);
    return shot;
  },
  updateShotResult: async (data) => {
    const shot = mockDbData.pendingShots.find(s => s.commitment_hash === data.commitment_hash);
    if (shot) {
      shot.status = data.win ? 'won' : 'lost';
      shot.reveal_tx_hash = data.txHash;
      shot.result = data.win ? 'win' : 'loss';
      if (data.win) {
        mockDbData.winners.push({
          id: 'winner-' + Date.now(),
          address: shot.address,
          amount: data.amount,
          timestamp: new Date()
        });
      }
    }
    return shot;
  },
  getPlayerDiscounts: async () => mockDbData.discounts,
  markDiscountUsed: async (id) => {
    const discount = mockDbData.discounts.find(d => d.id === id);
    if (discount) {
      discount.used = true;
    }
    return discount;
  },
  subscribeToWinners: () => ({ unsubscribe: () => {} }),
  subscribeToShots: () => ({ unsubscribe: () => {} }),
  subscribeToSponsors: () => ({ unsubscribe: () => {} })
};

// Mock contract interface
const mockContract = {
  commitShot: sinon.stub().resolves({ hash: '0xcommit123' }),
  revealShot: sinon.stub().resolves({ hash: '0xreveal123' }),
  SHOT_COST: sinon.stub().resolves('1000000000000000'),
  SPONSOR_COST: sinon.stub().resolves('1000000000000000'),
  getBalance: sinon.stub().resolves('10000000000000000'),
  HOUSE_FUNDS: sinon.stub().resolves('1000000000000000'),
  cooldownPeriod: sinon.stub().resolves(3600),
  playerCooldowns: sinon.stub().resolves(Math.floor(Date.now() / 1000) - 7200)
};

const mockEthers = {
  Contract: function() {
    return mockContract;
  },
  formatEther: (val) => val ? (Number(val) / 1e18).toString() : '0',
  parseEther: (val) => (Number(val) * 1e18).toString(),
  toBigInt: (val) => BigInt(val),
  ZeroAddress: '0x0000000000000000000000000000000000000000'
};

// Mock modules
const mocks = {
  './wallet.js': { walletStore: mockWalletStore },
  './toast.js': { 
    toastStore: { 
      error: sinon.spy(), 
      success: sinon.spy(), 
      info: sinon.spy() 
    } 
  },
  '../db/supabase.js': { db: mockDb },
  'ethers': mockEthers,
  '../crypto/adapters/ethereum.js': {
    ethereumAdapter: {
      getSigner: () => mockWalletStore.signer,
      getProvider: () => mockWalletStore.provider,
      getContract: () => mockContract
    }
  }
};

describe('Commit-Reveal Integration Flow', function() {
  let gameStore;
  let originalImport;
  let toastSpy;

  before(async function() {
    // Mock dynamic imports
    originalImport = global.import;
    global.import = async (module) => {
      if (mocks[module]) {
        return mocks[module];
      }
      return originalImport(module);
    };

    // Import the store
    const storeModule = await import('../../src/lib/stores/game/index.js');
    gameStore = storeModule.gameStore;
    toastSpy = mocks['./toast.js'].toastStore;

    // Initialize the store
    await gameStore.init();
  });

  afterEach(function() {
    // Reset spies and stubs
    sinon.restore();
    mockContract.commitShot.reset();
    mockContract.revealShot.reset();
    toastSpy.error.resetHistory();
    toastSpy.success.resetHistory();
    
    // Reset mock data
    mockDbData.pendingShots = [];
    mockDbData.discounts.forEach(d => d.used = false);
    
    // Reset store state
    gameStore.update(state => ({
      ...state,
      pendingShot: null,
      bonusShotsAvailable: 3,
      takingShot: false,
      error: null
    }));
  });

  after(function() {
    global.import = originalImport;
  });

  describe('Regular Shot Flow', function() {
    it('should complete the full commit-reveal flow for a regular shot', async function() {
      // 1. Commit a regular shot
      await gameStore.commitShot(false, null, false);
      
      // Verify the commit
      expect(mockContract.commitShot.calledOnce).to.be.true;
      
      let state = get(gameStore);
      expect(state.pendingShot).to.not.be.null;
      expect(state.pendingShot.commitHash).to.equal('0xcommit123');
      expect(state.takingShot).to.be.false;
      expect(toastSpy.success.calledOnce).to.be.true;
      
      // 2. Reveal the shot
      await gameStore.revealShot();
      
      // Verify the reveal
      expect(mockContract.revealShot.calledOnce).to.be.true;
      
      state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(state.takingShot).to.be.false;
      expect(toastSpy.success.calledTwice).to.be.true;
    });
  });
  
  describe('Bonus Shot Flow', function() {
    it('should complete the full commit-reveal flow using a bonus shot', async function() {
      // Setup bonus shots
      gameStore.update(state => ({
        ...state,
        bonusShotsAvailable: 3
      }));
      
      // 1. Commit using a bonus shot
      await gameStore.commitShot(false, null, true);
      
      // Verify the commit and bonus shot decrement
      expect(mockContract.commitShot.calledOnce).to.be.true;
      
      let state = get(gameStore);
      expect(state.bonusShotsAvailable).to.equal(2); // Decremented by 1
      expect(state.pendingShot).to.not.be.null;
      expect(state.pendingShot.useBonus).to.be.true;
      expect(toastSpy.success.calledOnce).to.be.true;
      
      // 2. Reveal the shot
      await gameStore.revealShot();
      
      // Verify the reveal
      expect(mockContract.revealShot.calledOnce).to.be.true;
      
      state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(state.takingShot).to.be.false;
      expect(toastSpy.success.calledTwice).to.be.true;
    });
    
    it('should prevent using a bonus shot when none are available', async function() {
      // Set bonus shots to 0
      gameStore.update(state => ({
        ...state,
        bonusShotsAvailable: 0
      }));
      
      // Try to commit with bonus shot
      await gameStore.commitShot(false, null, true);
      
      // Verify it was rejected
      expect(mockContract.commitShot.called).to.be.false;
      
      const state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(toastSpy.error.calledOnce).to.be.true;
    });
  });
  
  describe('Discount Shot Flow', function() {
    it('should complete the full commit-reveal flow using a discount', async function() {
      // 1. Commit using a discount
      await gameStore.commitShot(true, 'discount-123', false);
      
      // Verify the commit and discount usage
      expect(mockContract.commitShot.calledOnce).to.be.true;
      
      let state = get(gameStore);
      expect(state.pendingShot).to.not.be.null;
      expect(state.pendingShot.useDiscount).to.be.true;
      expect(state.pendingShot.discountId).to.equal('discount-123');
      expect(toastSpy.success.calledOnce).to.be.true;
      
      // Check if discount was marked as used in the database
      expect(mockDbData.discounts[0].used).to.be.true;
      
      // 2. Reveal the shot
      await gameStore.revealShot();
      
      // Verify the reveal
      expect(mockContract.revealShot.calledOnce).to.be.true;
      
      state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(state.takingShot).to.be.false;
      expect(toastSpy.success.calledTwice).to.be.true;
    });
    
    it('should prevent using a discount when none are available', async function() {
      // Set all discounts as used
      mockDbData.discounts.forEach(d => d.used = true);
      
      // Try to commit with discount
      await gameStore.commitShot(true, 'discount-123', false);
      
      // Verify it was rejected
      expect(mockContract.commitShot.called).to.be.false;
      
      const state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(toastSpy.error.calledOnce).to.be.true;
    });
  });
  
  describe('Error Recovery', function() {
    it('should handle commit transaction failures', async function() {
      // Make commit fail
      mockContract.commitShot.rejects(new Error('Transaction failed'));
      
      // Try to commit
      await gameStore.commitShot(false, null, false);
      
      // Verify error handling
      const state = get(gameStore);
      expect(state.pendingShot).to.be.null;
      expect(state.error).to.not.be.null;
      expect(toastSpy.error.calledOnce).to.be.true;
    });
    
    it('should handle reveal transaction failures', async function() {
      // First make a successful commit
      await gameStore.commitShot(false, null, false);
      
      // Make reveal fail
      mockContract.revealShot.rejects(new Error('Transaction failed'));
      
      // Try to reveal
      await gameStore.revealShot();
      
      // Verify error handling - pending shot should still be there
      const state = get(gameStore);
      expect(state.pendingShot).to.not.be.null;
      expect(state.error).to.not.be.null;
      expect(toastSpy.error.calledOnce).to.be.true;
    });
  });
});
