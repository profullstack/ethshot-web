// Test suite for cryptocurrency adapter factory and management
// Using Mocha test framework with Chai assertions

import { expect } from 'chai';
import { 
  CryptoAdapterFactory,
  cryptoAdapterFactory,
  getAdapter,
  getActiveAdapter,
  setActiveCrypto,
  getSupportedCryptos,
  CRYPTO_TYPES
} from '../../src/lib/crypto/adapters/index.js';
import { BaseCryptoAdapter } from '../../src/lib/crypto/adapters/base.js';
import { EthereumAdapter } from '../../src/lib/crypto/adapters/ethereum.js';
import { SolanaAdapter } from '../../src/lib/crypto/adapters/solana.js';

describe('Crypto Adapter Factory', () => {
  let factory;

  beforeEach(() => {
    factory = new CryptoAdapterFactory();
  });

  describe('CryptoAdapterFactory Class', () => {
    it('should create a new factory instance', () => {
      expect(factory).to.be.instanceOf(CryptoAdapterFactory);
      expect(factory.adapters).to.be.instanceOf(Map);
      expect(factory.activeAdapter).to.be.null;
    });

    it('should create ETH adapter', () => {
      const adapter = factory.createAdapter(CRYPTO_TYPES.ETH);
      
      expect(adapter).to.be.instanceOf(EthereumAdapter);
      expect(adapter).to.be.instanceOf(BaseCryptoAdapter);
      expect(adapter.config.type).to.equal(CRYPTO_TYPES.ETH);
    });

    it('should create SOL adapter', () => {
      const adapter = factory.createAdapter(CRYPTO_TYPES.SOL);
      
      expect(adapter).to.be.instanceOf(SolanaAdapter);
      expect(adapter).to.be.instanceOf(BaseCryptoAdapter);
      expect(adapter.config.type).to.equal(CRYPTO_TYPES.SOL);
    });

    it('should throw error for unsupported crypto type', () => {
      expect(() => factory.createAdapter('INVALID')).to.throw('No adapter found for cryptocurrency type: INVALID');
    });

    it('should reuse existing adapter instances', () => {
      const adapter1 = factory.createAdapter(CRYPTO_TYPES.ETH);
      const adapter2 = factory.createAdapter(CRYPTO_TYPES.ETH);
      
      expect(adapter1).to.equal(adapter2);
    });

    it('should get existing adapter', () => {
      const createdAdapter = factory.createAdapter(CRYPTO_TYPES.ETH);
      const retrievedAdapter = factory.getAdapter(CRYPTO_TYPES.ETH);
      
      expect(retrievedAdapter).to.equal(createdAdapter);
    });

    it('should return null for non-existing adapter', () => {
      const adapter = factory.getAdapter(CRYPTO_TYPES.SOL);
      expect(adapter).to.be.null;
    });

    it('should set active adapter', () => {
      const adapter = factory.setActiveAdapter(CRYPTO_TYPES.ETH);
      
      expect(factory.getActiveAdapter()).to.equal(adapter);
      expect(adapter.config.type).to.equal(CRYPTO_TYPES.ETH);
    });

    it('should get supported crypto types', () => {
      const supportedCryptos = factory.getSupportedCryptos();
      
      expect(supportedCryptos).to.be.an('array');
      expect(supportedCryptos).to.include(CRYPTO_TYPES.ETH);
      expect(supportedCryptos).to.include(CRYPTO_TYPES.SOL);
    });

    it('should check if crypto is supported', () => {
      expect(factory.isSupported(CRYPTO_TYPES.ETH)).to.be.true;
      expect(factory.isSupported(CRYPTO_TYPES.SOL)).to.be.true;
      expect(factory.isSupported('INVALID')).to.be.false;
    });

    it('should get adapter status', () => {
      factory.createAdapter(CRYPTO_TYPES.ETH);
      factory.setActiveAdapter(CRYPTO_TYPES.ETH);
      
      const status = factory.getStatus();
      
      expect(status).to.have.property(CRYPTO_TYPES.ETH);
      expect(status[CRYPTO_TYPES.ETH]).to.have.property('connected', false);
      expect(status[CRYPTO_TYPES.ETH]).to.have.property('initialized', false);
      expect(status[CRYPTO_TYPES.ETH]).to.have.property('isActive', true);
    });

    it('should remove adapter', async () => {
      const adapter = factory.createAdapter(CRYPTO_TYPES.ETH);
      factory.setActiveAdapter(CRYPTO_TYPES.ETH);
      
      await factory.removeAdapter(CRYPTO_TYPES.ETH);
      
      expect(factory.getAdapter(CRYPTO_TYPES.ETH)).to.be.null;
      expect(factory.getActiveAdapter()).to.be.null;
    });

    it('should disconnect all adapters', async () => {
      factory.createAdapter(CRYPTO_TYPES.ETH);
      factory.createAdapter(CRYPTO_TYPES.SOL);
      factory.setActiveAdapter(CRYPTO_TYPES.ETH);
      
      await factory.disconnectAll();
      
      expect(factory.getActiveAdapter()).to.be.null;
    });
  });

  describe('Global Factory Instance', () => {
    it('should provide global factory instance', () => {
      expect(cryptoAdapterFactory).to.be.instanceOf(CryptoAdapterFactory);
    });

    it('should get adapter using convenience function', () => {
      const adapter = getAdapter(CRYPTO_TYPES.ETH);
      
      expect(adapter).to.be.instanceOf(EthereumAdapter);
    });

    it('should set active crypto using convenience function', () => {
      const adapter = setActiveCrypto(CRYPTO_TYPES.ETH);
      const activeAdapter = getActiveAdapter();
      
      expect(activeAdapter).to.equal(adapter);
      expect(activeAdapter.config.type).to.equal(CRYPTO_TYPES.ETH);
    });

    it('should get supported cryptos using convenience function', () => {
      const supportedCryptos = getSupportedCryptos();
      
      expect(supportedCryptos).to.be.an('array');
      expect(supportedCryptos).to.include(CRYPTO_TYPES.ETH);
      expect(supportedCryptos).to.include(CRYPTO_TYPES.SOL);
    });
  });

  describe('Adapter Base Class Interface', () => {
    let ethAdapter;
    let solAdapter;

    beforeEach(() => {
      ethAdapter = factory.createAdapter(CRYPTO_TYPES.ETH);
      solAdapter = factory.createAdapter(CRYPTO_TYPES.SOL);
    });

    it('should have required base properties', () => {
      expect(ethAdapter).to.have.property('config');
      expect(ethAdapter).to.have.property('provider', null);
      expect(ethAdapter).to.have.property('signer', null);
      expect(ethAdapter).to.have.property('connected', false);
    });

    it('should have required base methods', () => {
      const requiredMethods = [
        'init', 'connect', 'disconnect', 'getBalance', 'switchNetwork',
        'addNetwork', 'getContract', 'takeShot', 'sponsorRound',
        'getCurrentPot', 'getPlayerStats', 'canTakeShot', 'getCooldownRemaining',
        'getCurrentSponsor', 'getRecentWinners', 'getShotCost', 'getSponsorCost',
        'getContractBalance', 'getHouseFunds', 'formatAmount', 'formatAddress',
        'parseAmount', 'formatUnits', 'isValidAddress', 'isValidAmount'
      ];

      requiredMethods.forEach(method => {
        expect(ethAdapter).to.have.property(method);
        expect(ethAdapter[method]).to.be.a('function');
      });
    });

    it('should format amounts correctly', () => {
      const formatted = ethAdapter.formatAmount('1.23456');
      expect(formatted).to.be.a('string');
    });

    it('should format addresses correctly', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const formatted = ethAdapter.formatAddress(address);
      expect(formatted).to.equal('0x1234...7890');
    });

    it('should validate addresses correctly', () => {
      const validEthAddress = '0x1234567890123456789012345678901234567890';
      const validSolAddress = '11111111111111111111111111111111';
      
      expect(ethAdapter.isValidAddress(validEthAddress)).to.be.true;
      expect(ethAdapter.isValidAddress(validSolAddress)).to.be.false;
      
      expect(solAdapter.isValidAddress(validSolAddress)).to.be.true;
      expect(solAdapter.isValidAddress(validEthAddress)).to.be.false;
    });

    it('should validate amounts correctly', () => {
      expect(ethAdapter.isValidAmount('1.0')).to.be.true;
      expect(ethAdapter.isValidAmount('0')).to.be.false;
      expect(ethAdapter.isValidAmount('-1')).to.be.false;
      expect(ethAdapter.isValidAmount('invalid')).to.be.false;
    });

    it('should get network configuration', () => {
      const mainnetConfig = ethAdapter.getNetworkConfig('mainnet');
      expect(mainnetConfig).to.have.property('chainId', 1);
      expect(mainnetConfig).to.have.property('name', 'Ethereum Mainnet');
    });

    it('should throw error for invalid network', () => {
      expect(() => ethAdapter.getNetworkConfig('invalid')).to.throw('Network invalid not found in ETH configuration');
    });

    it('should get current network configuration', () => {
      const currentNetwork = ethAdapter.getCurrentNetworkConfig();
      expect(currentNetwork).to.have.property('chainId');
      expect(currentNetwork).to.have.property('name');
    });

    it('should check wallet support', () => {
      expect(ethAdapter.isWalletSupported('metamask')).to.be.true;
      expect(ethAdapter.isWalletSupported('phantom')).to.be.false;
      
      expect(solAdapter.isWalletSupported('phantom')).to.be.true;
      expect(solAdapter.isWalletSupported('metamask')).to.be.false;
    });
  });

  describe('Ethereum Adapter Specific', () => {
    let ethAdapter;

    beforeEach(() => {
      ethAdapter = factory.createAdapter(CRYPTO_TYPES.ETH);
    });

    it('should have Ethereum-specific configuration', () => {
      expect(ethAdapter.config.type).to.equal(CRYPTO_TYPES.ETH);
      expect(ethAdapter.config.symbol).to.equal('ETH');
      expect(ethAdapter.config.decimals).to.equal(18);
    });

    it('should have Ethereum networks', () => {
      expect(ethAdapter.config.networks).to.have.property('mainnet');
      expect(ethAdapter.config.networks).to.have.property('sepolia');
      expect(ethAdapter.config.networks.mainnet.chainId).to.equal(1);
    });

    it('should have Ethereum wallet providers', () => {
      expect(ethAdapter.config.walletProviders).to.include('metamask');
      expect(ethAdapter.config.walletProviders).to.include('walletconnect');
    });

    it('should have contract ABI', () => {
      expect(ethAdapter.config.contractConfig.abi).to.be.an('array');
      expect(ethAdapter.config.contractConfig.abi.length).to.be.greaterThan(0);
    });
  });

  describe('Solana Adapter Specific', () => {
    let solAdapter;

    beforeEach(() => {
      solAdapter = factory.createAdapter(CRYPTO_TYPES.SOL);
    });

    it('should have Solana-specific configuration', () => {
      expect(solAdapter.config.type).to.equal(CRYPTO_TYPES.SOL);
      expect(solAdapter.config.symbol).to.equal('SOL');
      expect(solAdapter.config.decimals).to.equal(9);
    });

    it('should have Solana networks', () => {
      expect(solAdapter.config.networks).to.have.property('mainnet');
      expect(solAdapter.config.networks).to.have.property('devnet');
      expect(solAdapter.config.networks).to.have.property('testnet');
    });

    it('should have Solana wallet providers', () => {
      expect(solAdapter.config.walletProviders).to.include('phantom');
      expect(solAdapter.config.walletProviders).to.include('solflare');
    });

    it('should throw not implemented errors for Solana methods', async () => {
      try {
        await solAdapter.init();
        expect.fail('Should have thrown not implemented error');
      } catch (error) {
        expect(error.message).to.include('not yet implemented');
      }

      try {
        await solAdapter.connect();
        expect.fail('Should have thrown not implemented error');
      } catch (error) {
        expect(error.message).to.include('not yet implemented');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter creation errors gracefully', () => {
      expect(() => factory.createAdapter('INVALID')).to.throw();
    });

    it('should handle missing active adapter gracefully', () => {
      expect(factory.getActiveAdapter()).to.be.null;
    });

    it('should handle adapter removal of non-existing adapter', async () => {
      await factory.removeAdapter('NON_EXISTING');
      // Should not throw error
    });
  });
});