import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { get } from 'svelte/store';
import { walletStore } from '../../src/lib/stores/wallet.js';

// Mock Web3Modal and ethers
const mockWeb3Modal = {
  connect: sinon.stub(),
  disconnect: sinon.stub(),
  on: sinon.stub(),
  off: sinon.stub()
};

const mockProvider = {
  getSigner: sinon.stub(),
  getNetwork: sinon.stub(),
  getBalance: sinon.stub(),
  on: sinon.stub(),
  removeAllListeners: sinon.stub()
};

const mockSigner = {
  getAddress: sinon.stub(),
  getBalance: sinon.stub()
};

describe('Wallet Store', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Reset all stubs
    Object.values(mockWeb3Modal).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockProvider).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });
    Object.values(mockSigner).forEach(stub => {
      if (typeof stub.reset === 'function') stub.reset();
    });

    // Mock ethers
    global.ethers = {
      BrowserProvider: sandbox.stub().returns(mockProvider),
      formatEther: sandbox.stub().returns('1.0'),
      parseEther: sandbox.stub().returns('1000000000000000000')
    };

    // Mock Web3Modal
    global.Web3Modal = {
      Web3Modal: sandbox.stub().returns(mockWeb3Modal)
    };

    // Mock localStorage
    global.localStorage = {
      getItem: sandbox.stub(),
      setItem: sandbox.stub(),
      removeItem: sandbox.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
    walletStore.disconnect();
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const state = get(walletStore);
      
      expect(state.connected).to.be.false;
      expect(state.address).to.be.null;
      expect(state.balance).to.equal('0');
      expect(state.network).to.be.null;
      expect(state.signer).to.be.null;
      expect(state.loading).to.be.false;
      expect(state.error).to.be.null;
    });
  });

  describe('Wallet Connection', () => {
    beforeEach(() => {
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({
        name: 'sepolia',
        chainId: 11155111
      });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000'); // 1 ETH
    });

    it('should connect wallet successfully', async () => {
      await walletStore.connect();
      
      const state = get(walletStore);
      
      expect(state.connected).to.be.true;
      expect(state.address).to.equal('0x1234567890123456789012345678901234567890');
      expect(state.balance).to.equal('1.0');
      expect(state.network).to.deep.equal({
        name: 'sepolia',
        chainId: 11155111
      });
      expect(state.loading).to.be.false;
      expect(state.error).to.be.null;
    });

    it('should handle connection errors', async () => {
      mockWeb3Modal.connect.rejects(new Error('User rejected connection'));
      
      await walletStore.connect();
      
      const state = get(walletStore);
      
      expect(state.connected).to.be.false;
      expect(state.error).to.equal('User rejected connection');
      expect(state.loading).to.be.false;
    });

    it('should set loading state during connection', async () => {
      let loadingState;
      
      // Create a promise that we can control
      let resolveConnect;
      const connectPromise = new Promise(resolve => {
        resolveConnect = resolve;
      });
      mockWeb3Modal.connect.returns(connectPromise);
      
      // Start connection
      const connectionPromise = walletStore.connect();
      
      // Check loading state
      loadingState = get(walletStore);
      expect(loadingState.loading).to.be.true;
      
      // Resolve connection
      resolveConnect('mock-provider');
      await connectionPromise;
      
      // Check final state
      const finalState = get(walletStore);
      expect(finalState.loading).to.be.false;
    });
  });

  describe('Wallet Disconnection', () => {
    beforeEach(async () => {
      // Set up connected state
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({ name: 'sepolia', chainId: 11155111 });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000');
      
      await walletStore.connect();
    });

    it('should disconnect wallet successfully', async () => {
      await walletStore.disconnect();
      
      const state = get(walletStore);
      
      expect(state.connected).to.be.false;
      expect(state.address).to.be.null;
      expect(state.balance).to.equal('0');
      expect(state.network).to.be.null;
      expect(state.signer).to.be.null;
      expect(state.error).to.be.null;
    });

    it('should clean up event listeners on disconnect', async () => {
      await walletStore.disconnect();
      
      expect(mockProvider.removeAllListeners).to.have.been.called;
    });
  });

  describe('Balance Updates', () => {
    beforeEach(async () => {
      // Set up connected state
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({ name: 'sepolia', chainId: 11155111 });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000');
      
      await walletStore.connect();
    });

    it('should update balance successfully', async () => {
      mockProvider.getBalance.resolves('2000000000000000000'); // 2 ETH
      global.ethers.formatEther.returns('2.0');
      
      await walletStore.updateBalance();
      
      const state = get(walletStore);
      expect(state.balance).to.equal('2.0');
    });

    it('should handle balance update errors', async () => {
      mockProvider.getBalance.rejects(new Error('Network error'));
      
      await walletStore.updateBalance();
      
      const state = get(walletStore);
      expect(state.error).to.equal('Network error');
    });
  });

  describe('Network Switching', () => {
    beforeEach(async () => {
      // Set up connected state
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({ name: 'sepolia', chainId: 11155111 });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000');
      
      await walletStore.connect();
    });

    it('should handle network changes', async () => {
      const newNetwork = { name: 'mainnet', chainId: 1 };
      mockProvider.getNetwork.resolves(newNetwork);
      
      // Simulate network change event
      const networkChangeHandler = mockProvider.on.getCall(0).args[1];
      await networkChangeHandler(newNetwork);
      
      const state = get(walletStore);
      expect(state.network).to.deep.equal(newNetwork);
    });
  });

  describe('Account Changes', () => {
    beforeEach(async () => {
      // Set up connected state
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({ name: 'sepolia', chainId: 11155111 });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000');
      
      await walletStore.connect();
    });

    it('should handle account changes', async () => {
      const newAddress = '0x9876543210987654321098765432109876543210';
      mockSigner.getAddress.resolves(newAddress);
      mockProvider.getBalance.resolves('500000000000000000'); // 0.5 ETH
      global.ethers.formatEther.returns('0.5');
      
      // Simulate account change
      const accountChangeHandler = mockProvider.on.getCall(1).args[1];
      await accountChangeHandler([newAddress]);
      
      const state = get(walletStore);
      expect(state.address).to.equal(newAddress);
      expect(state.balance).to.equal('0.5');
    });

    it('should disconnect when no accounts available', async () => {
      // Simulate account change with empty array
      const accountChangeHandler = mockProvider.on.getCall(1).args[1];
      await accountChangeHandler([]);
      
      const state = get(walletStore);
      expect(state.connected).to.be.false;
      expect(state.address).to.be.null;
    });
  });

  describe('Utility Functions', () => {
    it('should format address correctly', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const formatted = walletStore.formatAddress(address);
      
      expect(formatted).to.equal('0x1234...7890');
    });

    it('should handle null address in formatting', () => {
      const formatted = walletStore.formatAddress(null);
      
      expect(formatted).to.equal('');
    });

    it('should handle short address in formatting', () => {
      const shortAddress = '0x1234';
      const formatted = walletStore.formatAddress(shortAddress);
      
      expect(formatted).to.equal('0x1234');
    });
  });

  describe('Persistence', () => {
    it('should save connection state to localStorage', async () => {
      mockWeb3Modal.connect.resolves('mock-provider');
      mockProvider.getSigner.resolves(mockSigner);
      mockProvider.getNetwork.resolves({ name: 'sepolia', chainId: 11155111 });
      mockSigner.getAddress.resolves('0x1234567890123456789012345678901234567890');
      mockProvider.getBalance.resolves('1000000000000000000');
      
      await walletStore.connect();
      
      expect(global.localStorage.setItem).to.have.been.calledWith(
        'wallet-connected',
        'true'
      );
    });

    it('should remove connection state from localStorage on disconnect', async () => {
      await walletStore.disconnect();
      
      expect(global.localStorage.removeItem).to.have.been.calledWith(
        'wallet-connected'
      );
    });

    it('should restore connection state from localStorage', () => {
      global.localStorage.getItem.returns('true');
      
      // This would typically be called on app initialization
      // The actual implementation would check localStorage and auto-connect
      expect(global.localStorage.getItem).to.have.been.calledWith(
        'wallet-connected'
      );
    });
  });
});