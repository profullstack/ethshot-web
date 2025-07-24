import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { get } from 'svelte/store';
import { gameStore } from '../../src/lib/stores/game.js';

// Mock dependencies
const mockContract = {
  getCurrentPot: sinon.stub(),
  SHOT_COST: sinon.stub(),
  SPONSOR_COST: sinon.stub(),
  getCurrentSponsor: sinon.stub(),
  getRecentWinners: sinon.stub(),
  getPlayerStats: sinon.stub(),
  canTakeShot: sinon.stub(),
  getCooldownRemaining: sinon.stub(),
  takeShot: sinon.stub(),
  sponsorRound: sinon.stub(),
  interface: {
    parseLog: sinon.stub()
  },
  connect: sinon.stub()
};

const mockDb = {
  getRecentWinners: sinon.stub(),
  getGameStats: sinon.stub(),
  getCurrentSponsor: sinon.stub(),
  getTopPlayers: sinon.stub(),
  getPlayerStats: sinon.stub(),
  recordShot: sinon.stub(),
  recordWinner: sinon.stub(),
  recordSponsor: sinon.stub(),
  subscribeToWinners: sinon.stub(),
  subscribeToShots: sinon.stub(),
  subscribeToSponsors: sinon.stub()
};

const mockWallet = {
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  signer: {
    getAddress: () => '0x1234567890123456789012345678901234567890'
  }
};

const mockToast = {
  success: sinon.stub(),
  error: sinon.stub(),
  info: sinon.stub()
};

describe('Game Store', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Reset all stubs
    Object.values(mockContract).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockDb).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockToast).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });

    // Mock ethers
    global.ethers = {
      JsonRpcProvider: sandbox.stub().returns({}),
      Contract: sandbox.stub().returns(mockContract),
      formatEther: sandbox.stub().returns('1.0'),
      parseEther: sandbox.stub().returns('1000000000000000000')
    };

    // Mock environment variables
    global.import = {
      meta: {
        env: {
          VITE_CONTRACT_ADDRESS: '0xcontract123',
          VITE_RPC_URL: 'https://sepolia.infura.io/v3/demo'
        }
      }
    };
  });

  afterEach(() => {
    sandbox.restore();
    gameStore.stopRealTimeUpdates();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = get(gameStore);
      
      expect(state.currentPot).to.equal('0');
      expect(state.shotCost).to.equal('0.001');
      expect(state.sponsorCost).to.equal('0.05');
      expect(state.loading).to.be.false;
      expect(state.takingShot).to.be.false;
      expect(state.recentWinners).to.be.an('array').that.is.empty;
      expect(state.topPlayers).to.be.an('array').that.is.empty;
    });

    it('should handle missing contract address gracefully', async () => {
      global.import.meta.env.VITE_CONTRACT_ADDRESS = '';
      
      await gameStore.init();
      
      const state = get(gameStore);
      expect(state.loading).to.be.false;
      expect(state.error).to.be.null;
    });
  });

  describe('Game State Loading', () => {
    beforeEach(() => {
      // Setup contract mock responses
      mockContract.getCurrentPot.resolves('1000000000000000000'); // 1 ETH
      mockContract.SHOT_COST.resolves('1000000000000000'); // 0.001 ETH
      mockContract.SPONSOR_COST.resolves('50000000000000000'); // 0.05 ETH
      mockContract.getCurrentSponsor.resolves({
        sponsor: '0xsponsor123',
        name: 'Test Sponsor',
        logoUrl: 'https://example.com/logo.png',
        timestamp: 1234567890,
        active: true
      });
      mockContract.getRecentWinners.resolves([
        {
          winner: '0xwinner123',
          amount: '500000000000000000', // 0.5 ETH
          timestamp: 1234567890,
          blockNumber: 12345
        }
      ]);

      // Setup database mock responses
      mockDb.getRecentWinners.resolves([
        {
          player_address: '0xwinner456',
          amount: '0.75',
          timestamp: '2023-01-01T00:00:00Z',
          tx_hash: '0xtx123'
        }
      ]);
      mockDb.getGameStats.resolves({
        total_shots: 100,
        total_pot: '10.5',
        total_winners: 5
      });
      mockDb.getCurrentSponsor.resolves({
        sponsor_address: '0xsponsor456',
        name: 'DB Sponsor',
        logo_url: 'https://example.com/db-logo.png',
        active: true
      });
      mockDb.getTopPlayers.resolves([
        {
          player_address: '0xtop1',
          total_won: '2.5',
          total_shots: 50
        }
      ]);
    });

    it('should load game state from contract and database', async () => {
      await gameStore.loadGameState();
      
      const state = get(gameStore);
      
      expect(state.currentPot).to.equal('1.0');
      expect(state.shotCost).to.equal('1.0');
      expect(state.sponsorCost).to.equal('1.0');
      expect(state.recentWinners).to.have.length(1);
      expect(state.topPlayers).to.have.length(1);
      expect(state.lastUpdate).to.be.a('string');
    });

    it('should prefer database data over contract data for winners', async () => {
      await gameStore.loadGameState();
      
      const state = get(gameStore);
      
      // Should use database winners (0xwinner456) over contract winners (0xwinner123)
      expect(state.recentWinners[0].player_address).to.equal('0xwinner456');
      expect(state.recentWinners[0].amount).to.equal('0.75');
    });

    it('should handle contract errors gracefully', async () => {
      mockContract.getCurrentPot.rejects(new Error('Contract error'));
      
      await gameStore.loadGameState();
      
      const state = get(gameStore);
      expect(state.error).to.equal('Contract error');
    });
  });

  describe('Player Data Loading', () => {
    beforeEach(() => {
      mockContract.getPlayerStats.resolves({
        totalShots: 10,
        totalSpent: '10000000000000000', // 0.01 ETH
        totalWon: '500000000000000000', // 0.5 ETH
        lastShotTime: 1234567890
      });
      mockContract.canTakeShot.resolves(true);
      mockContract.getCooldownRemaining.resolves(0);
      
      mockDb.getPlayerStats.resolves({
        rank: 5,
        win_rate: 0.1,
        last_win_amount: '0.25'
      });
    });

    it('should load player data from contract and database', async () => {
      await gameStore.loadPlayerData('0xplayer123');
      
      const state = get(gameStore);
      
      expect(state.playerStats.totalShots).to.equal(10);
      expect(state.playerStats.totalSpent).to.equal('1.0');
      expect(state.playerStats.totalWon).to.equal('1.0');
      expect(state.playerStats.rank).to.equal(5);
      expect(state.playerStats.win_rate).to.equal(0.1);
      expect(state.canShoot).to.be.true;
      expect(state.cooldownRemaining).to.equal(0);
    });

    it('should handle missing address gracefully', async () => {
      await gameStore.loadPlayerData(null);
      
      const state = get(gameStore);
      expect(state.playerStats).to.be.null;
    });
  });

  describe('Taking Shots', () => {
    let mockSigner, mockContractWithSigner, mockTx, mockReceipt;

    beforeEach(() => {
      mockSigner = {
        getAddress: sinon.stub().resolves('0xplayer123')
      };
      
      mockContractWithSigner = {
        takeShot: sinon.stub()
      };
      
      mockTx = {
        wait: sinon.stub()
      };
      
      mockReceipt = {
        hash: '0xtxhash123',
        blockNumber: 12345,
        logs: [
          {
            topics: ['0xshot_taken_topic'],
            data: '0xdata'
          }
        ]
      };

      mockContract.connect.returns(mockContractWithSigner);
      mockContract.SHOT_COST.resolves('1000000000000000'); // 0.001 ETH
      mockContractWithSigner.takeShot.resolves(mockTx);
      mockTx.wait.resolves(mockReceipt);
      
      // Mock successful shot parsing
      mockContract.interface.parseLog.returns({
        name: 'ShotTaken',
        args: { won: false }
      });

      mockDb.recordShot.resolves();
    });

    it('should take a shot successfully', async () => {
      // Mock wallet store
      const mockWalletStore = {
        connected: true,
        signer: mockSigner,
        address: '0xplayer123'
      };

      // Mock get function to return wallet state
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.takeShot();
      
      expect(mockContractWithSigner.takeShot).to.have.been.calledOnce;
      expect(mockDb.recordShot).to.have.been.calledOnce;
      
      const recordShotCall = mockDb.recordShot.getCall(0);
      expect(recordShotCall.args[0]).to.deep.include({
        player_address: '0xplayer123',
        won: false,
        tx_hash: '0xtxhash123',
        block_number: 12345
      });
    });

    it('should handle winning shots', async () => {
      mockContract.interface.parseLog.returns({
        name: 'ShotTaken',
        args: { won: true }
      });
      mockContract.getCurrentPot.resolves('1000000000000000000'); // 1 ETH
      mockDb.recordWinner.resolves();

      const mockWalletStore = {
        connected: true,
        signer: mockSigner,
        address: '0xplayer123'
      };
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.takeShot();
      
      expect(mockDb.recordShot).to.have.been.calledWith(
        sinon.match({ won: true })
      );
      expect(mockDb.recordWinner).to.have.been.calledOnce;
    });

    it('should handle transaction errors', async () => {
      mockContractWithSigner.takeShot.rejects(new Error('insufficient funds'));

      const mockWalletStore = {
        connected: true,
        signer: mockSigner,
        address: '0xplayer123'
      };
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.takeShot();
      
      const state = get(gameStore);
      expect(state.error).to.equal('Insufficient ETH balance');
      expect(state.takingShot).to.be.false;
    });

    it('should require wallet connection', async () => {
      const mockWalletStore = {
        connected: false,
        signer: null,
        address: null
      };
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.takeShot();
      
      expect(mockContractWithSigner.takeShot).to.not.have.been.called;
      expect(mockToast.error).to.have.been.calledWith('Please connect your wallet first');
    });
  });

  describe('Sponsoring Rounds', () => {
    let mockSigner, mockContractWithSigner, mockTx, mockReceipt;

    beforeEach(() => {
      mockSigner = {
        getAddress: sinon.stub().resolves('0xsponsor123')
      };
      
      mockContractWithSigner = {
        sponsorRound: sinon.stub()
      };
      
      mockTx = {
        wait: sinon.stub()
      };
      
      mockReceipt = {
        hash: '0xsponsortx123',
        blockNumber: 12346
      };

      mockContract.connect.returns(mockContractWithSigner);
      mockContract.SPONSOR_COST.resolves('50000000000000000'); // 0.05 ETH
      mockContractWithSigner.sponsorRound.resolves(mockTx);
      mockTx.wait.resolves(mockReceipt);
      
      mockDb.recordSponsor.resolves();
    });

    it('should sponsor a round successfully', async () => {
      const mockWalletStore = {
        connected: true,
        signer: mockSigner,
        address: '0xsponsor123'
      };
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.sponsorRound('Test Sponsor', 'https://example.com/logo.png');
      
      expect(mockContractWithSigner.sponsorRound).to.have.been.calledWith(
        'Test Sponsor',
        'https://example.com/logo.png',
        sinon.match.object
      );
      expect(mockDb.recordSponsor).to.have.been.calledOnce;
      
      const recordSponsorCall = mockDb.recordSponsor.getCall(0);
      expect(recordSponsorCall.args[0]).to.deep.include({
        sponsor_address: '0xsponsor123',
        name: 'Test Sponsor',
        logo_url: 'https://example.com/logo.png',
        tx_hash: '0xsponsortx123',
        block_number: 12346,
        active: true
      });
    });

    it('should validate sponsor parameters', async () => {
      const mockWalletStore = {
        connected: true,
        signer: mockSigner,
        address: '0xsponsor123'
      };
      sandbox.stub(global, 'get').returns(mockWalletStore);

      await gameStore.sponsorRound('', 'https://example.com/logo.png');
      
      expect(mockContractWithSigner.sponsorRound).to.not.have.been.called;
      expect(mockToast.error).to.have.been.calledWith('Please provide sponsor name and logo URL');
    });
  });

  describe('Real-time Updates', () => {
    it('should set up real-time subscriptions', () => {
      const mockSubscription = { unsubscribe: sinon.stub() };
      mockDb.subscribeToWinners.returns(mockSubscription);
      mockDb.subscribeToShots.returns(mockSubscription);
      mockDb.subscribeToSponsors.returns(mockSubscription);

      gameStore.startRealTimeUpdates();
      
      expect(mockDb.subscribeToWinners).to.have.been.calledOnce;
      expect(mockDb.subscribeToShots).to.have.been.calledOnce;
      expect(mockDb.subscribeToSponsors).to.have.been.calledOnce;
    });

    it('should clean up subscriptions on stop', () => {
      const mockSubscription = { unsubscribe: sinon.stub() };
      mockDb.subscribeToWinners.returns(mockSubscription);
      mockDb.subscribeToShots.returns(mockSubscription);
      mockDb.subscribeToSponsors.returns(mockSubscription);

      gameStore.startRealTimeUpdates();
      gameStore.stopRealTimeUpdates();
      
      expect(mockSubscription.unsubscribe).to.have.been.calledThrice;
    });
  });

  describe('Utility Functions', () => {
    it('should format time remaining correctly', () => {
      expect(gameStore.formatTimeRemaining(0)).to.equal('0s');
      expect(gameStore.formatTimeRemaining(30)).to.equal('30s');
      expect(gameStore.formatTimeRemaining(90)).to.equal('1m 30s');
      expect(gameStore.formatTimeRemaining(3661)).to.equal('1h 1m');
    });

    it('should handle social sharing', () => {
      const mockWindow = {
        open: sinon.stub()
      };
      global.window = mockWindow;

      gameStore.shareOnTwitter();
      
      expect(mockWindow.open).to.have.been.calledOnce;
      const url = mockWindow.open.getCall(0).args[0];
      expect(url).to.include('twitter.com/intent/tweet');
      expect(url).to.include('ETHShot');
    });

    it('should copy link to clipboard', async () => {
      const mockNavigator = {
        clipboard: {
          writeText: sinon.stub().resolves()
        }
      };
      global.navigator = mockNavigator;

      await gameStore.copyLink();
      
      expect(mockNavigator.clipboard.writeText).to.have.been.calledWith('https://ethshot.io');
      expect(mockToast.success).to.have.been.calledWith('Link copied to clipboard!');
    });
  });
});