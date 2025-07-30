/**
 * Test for reveal confirmation fix
 * Verifies that multi-crypto mode now properly separates commit and reveal phases
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

// Mock browser environment
global.browser = true;

// Mock toast store
const mockToastStore = {
  info: sinon.spy(),
  success: sinon.spy(),
  error: sinon.spy(),
  warning: sinon.spy()
};

// Mock adapter
const mockAdapter = {
  generateSecret: sinon.stub().returns('0x1234567890abcdef'),
  generateCommitment: sinon.stub().returns('0xcommitment123'),
  commitShot: sinon.stub().resolves({
    hash: '0xcommit123',
    receipt: { blockNumber: 100 }
  }),
  revealShot: sinon.stub().resolves({
    hash: '0xreveal123',
    receipt: { blockNumber: 101 },
    won: false
  })
};

// Mock getActiveAdapter
const mockGetActiveAdapter = sinon.stub().returns(mockAdapter);

// Mock wallet
const mockWallet = {
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  signer: {}
};

// Mock state
const mockState = {
  isMultiCryptoMode: true,
  activeCrypto: 'ETH',
  shotCost: '0.001',
  currentPot: '1.0',
  availableDiscounts: [],
  pendingShot: null
};

// Mock functions
const mockUpdateState = sinon.spy();
const mockLoadGameState = sinon.spy();
const mockLoadPlayerData = sinon.spy();
const mockWalletStore = { updateBalance: sinon.spy() };
const mockDb = {};

describe('Reveal Confirmation Fix', function() {
  let takeShot, revealShot;
  
  beforeEach(async function() {
    // Reset all spies and stubs
    sinon.resetHistory();
    mockAdapter.commitShot.resetHistory();
    mockAdapter.revealShot.resetHistory();
    mockToastStore.info.resetHistory();
    mockToastStore.success.resetHistory();
    mockUpdateState.resetHistory();
    
    // Mock the imports
    const originalImport = global.import;
    global.import = async (module) => {
      if (module.includes('toast.js')) {
        return { toastStore: mockToastStore };
      }
      if (module.includes('adapters/index.js')) {
        return { getActiveAdapter: mockGetActiveAdapter };
      }
      return originalImport(module);
    };

    // Import the functions we want to test
    const playerOpsModule = await import('../src/lib/stores/game/player-operations.js');
    takeShot = playerOpsModule.takeShot;
    revealShot = playerOpsModule.revealShot;
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('Multi-crypto Mode Commit-Reveal Separation', function() {
    it('should only commit the shot and not auto-reveal in multi-crypto mode', async function() {
      // Call takeShot
      await takeShot({
        useDiscount: false,
        discountId: null,
        customShotCost: null,
        state: mockState,
        contract: null, // Not used in multi-crypto mode
        ethers: null,   // Not used in multi-crypto mode
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify commit was called
      expect(mockAdapter.commitShot.calledOnce).to.be.true;
      
      // Verify reveal was NOT called automatically
      expect(mockAdapter.revealShot.called).to.be.false;
      
      // Verify commit confirmation message was shown
      expect(mockToastStore.info.calledWith('Shot committed! Waiting for reveal window...')).to.be.true;
      
      // Verify pending shot was stored in state
      expect(mockUpdateState.calledWith(sinon.match(fn => {
        const newState = fn(mockState);
        return newState.pendingShot && 
               newState.pendingShot.secret === '0x1234567890abcdef' &&
               newState.pendingShot.commitment === '0xcommitment123';
      }))).to.be.true;
    });

    it('should properly reveal the shot when revealShot is called separately', async function() {
      // Setup state with pending shot
      const stateWithPending = {
        ...mockState,
        pendingShot: {
          secret: '0x1234567890abcdef',
          commitment: '0xcommitment123',
          timestamp: new Date().toISOString(),
          actualShotCost: '0.001',
          discountApplied: false,
          discountPercentage: 0
        }
      };

      // Call revealShot
      await revealShot({
        secret: null, // Should use secret from pending shot
        state: stateWithPending,
        contract: null,
        ethers: null,
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify reveal was called with correct secret
      expect(mockAdapter.revealShot.calledOnce).to.be.true;
      expect(mockAdapter.revealShot.calledWith('0x1234567890abcdef')).to.be.true;
      
      // Verify reveal confirmation messages were shown
      expect(mockToastStore.info.calledWith('🎲 Revealing shot result...')).to.be.true;
      expect(mockToastStore.info.calledWith('🎲 Shot revealed - No win this time. Better luck next shot!')).to.be.true;
      
      // Verify pending shot was cleared from state
      expect(mockUpdateState.calledWith(sinon.match(fn => {
        const newState = fn(stateWithPending);
        return newState.pendingShot === null;
      }))).to.be.true;
    });

    it('should show proper win confirmation messages when shot wins', async function() {
      // Setup winning reveal
      mockAdapter.revealShot.resolves({
        hash: '0xreveal123',
        receipt: { blockNumber: 101 },
        won: true
      });

      const stateWithPending = {
        ...mockState,
        pendingShot: {
          secret: '0x1234567890abcdef',
          commitment: '0xcommitment123',
          timestamp: new Date().toISOString(),
          actualShotCost: '0.001',
          discountApplied: false,
          discountPercentage: 0
        }
      };

      // Call revealShot
      await revealShot({
        secret: null,
        state: stateWithPending,
        contract: null,
        ethers: null,
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify winning messages were shown
      expect(mockToastStore.success.calledWith('🎉 JACKPOT! YOU WON! 🎊')).to.be.true;
      
      // Check that multiple success messages are scheduled
      expect(mockToastStore.success.callCount).to.be.at.least(1);
    });

    it('should handle reveal with explicit secret parameter', async function() {
      const explicitSecret = '0xexplicitsecret123';
      
      // Call revealShot with explicit secret
      await revealShot({
        secret: explicitSecret,
        state: mockState,
        contract: null,
        ethers: null,
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify reveal was called with explicit secret
      expect(mockAdapter.revealShot.calledOnce).to.be.true;
      expect(mockAdapter.revealShot.calledWith(explicitSecret)).to.be.true;
    });
  });

  describe('Error Handling', function() {
    it('should handle missing secret gracefully', async function() {
      // Call revealShot without secret and without pending shot
      await revealShot({
        secret: null,
        state: mockState, // No pending shot
        contract: null,
        ethers: null,
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify error was shown
      expect(mockToastStore.error.calledWith('No secret available for reveal. Please take a new shot.')).to.be.true;
      
      // Verify reveal was not called
      expect(mockAdapter.revealShot.called).to.be.false;
    });

    it('should handle adapter reveal failure', async function() {
      // Setup adapter to fail
      mockAdapter.revealShot.rejects(new Error('Reveal failed'));

      const stateWithPending = {
        ...mockState,
        pendingShot: {
          secret: '0x1234567890abcdef',
          commitment: '0xcommitment123',
          timestamp: new Date().toISOString(),
          actualShotCost: '0.001',
          discountApplied: false,
          discountPercentage: 0
        }
      };

      // Call revealShot
      await revealShot({
        secret: null,
        state: stateWithPending,
        contract: null,
        ethers: null,
        wallet: mockWallet,
        db: mockDb,
        updateState: mockUpdateState,
        loadGameState: mockLoadGameState,
        loadPlayerData: mockLoadPlayerData,
        walletStore: mockWalletStore
      });

      // Verify error was handled
      expect(mockToastStore.error.calledWith('Reveal failed')).to.be.true;
    });
  });
});