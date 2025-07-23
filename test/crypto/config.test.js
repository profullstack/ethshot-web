// Test suite for multi-cryptocurrency configuration system
// Using Mocha test framework with Chai assertions

import { expect } from 'chai';
import {
  CRYPTO_TYPES,
  NETWORK_TYPES,
  WALLET_PROVIDERS,
  ETH_CONFIG,
  SOL_CONFIG,
  CRYPTO_REGISTRY,
  getCryptoConfig,
  getCurrentCrypto,
  getSupportedCryptos,
  isCryptoSupported,
  CRYPTO_GAME_CONFIG,
  getCryptoGameConfig
} from '../../src/lib/crypto/config.js';

describe('Multi-Crypto Configuration System', () => {
  describe('Constants', () => {
    it('should define correct crypto types', () => {
      expect(CRYPTO_TYPES).to.deep.equal({
        ETH: 'ETH',
        SOL: 'SOL'
      });
    });

    it('should define correct network types', () => {
      expect(NETWORK_TYPES).to.deep.equal({
        ETHEREUM: 'ethereum',
        SOLANA: 'solana'
      });
    });

    it('should define wallet providers', () => {
      expect(WALLET_PROVIDERS).to.have.property('METAMASK', 'metamask');
      expect(WALLET_PROVIDERS).to.have.property('PHANTOM', 'phantom');
      expect(WALLET_PROVIDERS).to.have.property('WALLETCONNECT', 'walletconnect');
    });
  });

  describe('ETH Configuration', () => {
    it('should have correct ETH configuration structure', () => {
      expect(ETH_CONFIG).to.have.property('type', CRYPTO_TYPES.ETH);
      expect(ETH_CONFIG).to.have.property('name', 'Ethereum');
      expect(ETH_CONFIG).to.have.property('symbol', 'ETH');
      expect(ETH_CONFIG).to.have.property('decimals', 18);
      expect(ETH_CONFIG).to.have.property('networkType', NETWORK_TYPES.ETHEREUM);
    });

    it('should have required networks', () => {
      expect(ETH_CONFIG.networks).to.have.property('mainnet');
      expect(ETH_CONFIG.networks).to.have.property('sepolia');
      expect(ETH_CONFIG.networks.mainnet).to.have.property('chainId', 1);
      expect(ETH_CONFIG.networks.sepolia).to.have.property('chainId', 11155111);
    });

    it('should have supported wallet providers', () => {
      expect(ETH_CONFIG.walletProviders).to.include(WALLET_PROVIDERS.METAMASK);
      expect(ETH_CONFIG.walletProviders).to.include(WALLET_PROVIDERS.WALLETCONNECT);
    });

    it('should have contract configuration', () => {
      expect(ETH_CONFIG.contractConfig).to.have.property('abi');
      expect(ETH_CONFIG.contractConfig.abi).to.be.an('array');
      expect(ETH_CONFIG.contractConfig.abi.length).to.be.greaterThan(0);
    });

    it('should have formatters', () => {
      expect(ETH_CONFIG.formatters).to.have.property('formatAmount');
      expect(ETH_CONFIG.formatters).to.have.property('formatAddress');
      expect(ETH_CONFIG.formatters.formatAmount).to.be.a('function');
      expect(ETH_CONFIG.formatters.formatAddress).to.be.a('function');
    });

    it('should have validators', () => {
      expect(ETH_CONFIG.validators).to.have.property('isValidAddress');
      expect(ETH_CONFIG.validators).to.have.property('isValidAmount');
      expect(ETH_CONFIG.validators.isValidAddress).to.be.a('function');
      expect(ETH_CONFIG.validators.isValidAmount).to.be.a('function');
    });
  });

  describe('SOL Configuration', () => {
    it('should have correct SOL configuration structure', () => {
      expect(SOL_CONFIG).to.have.property('type', CRYPTO_TYPES.SOL);
      expect(SOL_CONFIG).to.have.property('name', 'Solana');
      expect(SOL_CONFIG).to.have.property('symbol', 'SOL');
      expect(SOL_CONFIG).to.have.property('decimals', 9);
      expect(SOL_CONFIG).to.have.property('networkType', NETWORK_TYPES.SOLANA);
    });

    it('should have required networks', () => {
      expect(SOL_CONFIG.networks).to.have.property('mainnet');
      expect(SOL_CONFIG.networks).to.have.property('devnet');
      expect(SOL_CONFIG.networks).to.have.property('testnet');
    });

    it('should have supported wallet providers', () => {
      expect(SOL_CONFIG.walletProviders).to.include(WALLET_PROVIDERS.PHANTOM);
      expect(SOL_CONFIG.walletProviders).to.include(WALLET_PROVIDERS.SOLFLARE);
    });
  });

  describe('Crypto Registry', () => {
    it('should contain all crypto configurations', () => {
      expect(CRYPTO_REGISTRY).to.have.property(CRYPTO_TYPES.ETH, ETH_CONFIG);
      expect(CRYPTO_REGISTRY).to.have.property(CRYPTO_TYPES.SOL, SOL_CONFIG);
    });

    it('should get crypto config by type', () => {
      const ethConfig = getCryptoConfig(CRYPTO_TYPES.ETH);
      expect(ethConfig).to.equal(ETH_CONFIG);

      const solConfig = getCryptoConfig(CRYPTO_TYPES.SOL);
      expect(solConfig).to.equal(SOL_CONFIG);
    });

    it('should throw error for unsupported crypto type', () => {
      expect(() => getCryptoConfig('INVALID')).to.throw('Unsupported cryptocurrency type: INVALID');
    });

    it('should get current crypto (defaults to ETH)', () => {
      const currentCrypto = getCurrentCrypto();
      expect(currentCrypto.type).to.equal(CRYPTO_TYPES.ETH);
    });

    it('should get supported cryptos', () => {
      const supportedCryptos = getSupportedCryptos();
      expect(supportedCryptos).to.be.an('array');
      expect(supportedCryptos).to.have.length(2);
      expect(supportedCryptos[0].type).to.equal(CRYPTO_TYPES.ETH);
      expect(supportedCryptos[1].type).to.equal(CRYPTO_TYPES.SOL);
    });

    it('should check if crypto is supported', () => {
      expect(isCryptoSupported(CRYPTO_TYPES.ETH)).to.be.true;
      expect(isCryptoSupported(CRYPTO_TYPES.SOL)).to.be.true;
      expect(isCryptoSupported('INVALID')).to.be.false;
    });
  });

  describe('Game Configuration', () => {
    it('should have game config for all crypto types', () => {
      expect(CRYPTO_GAME_CONFIG).to.have.property(CRYPTO_TYPES.ETH);
      expect(CRYPTO_GAME_CONFIG).to.have.property(CRYPTO_TYPES.SOL);
    });

    it('should have required game config properties', () => {
      const ethGameConfig = CRYPTO_GAME_CONFIG[CRYPTO_TYPES.ETH];
      expect(ethGameConfig).to.have.property('shotCost');
      expect(ethGameConfig).to.have.property('sponsorCost');
      expect(ethGameConfig).to.have.property('winPercentage');
      expect(ethGameConfig).to.have.property('housePercentage');
      expect(ethGameConfig).to.have.property('cooldownHours');
      expect(ethGameConfig).to.have.property('usdPrice');
    });

    it('should get crypto game config', () => {
      const ethGameConfig = getCryptoGameConfig(CRYPTO_TYPES.ETH);
      expect(ethGameConfig).to.equal(CRYPTO_GAME_CONFIG[CRYPTO_TYPES.ETH]);

      const solGameConfig = getCryptoGameConfig(CRYPTO_TYPES.SOL);
      expect(solGameConfig).to.equal(CRYPTO_GAME_CONFIG[CRYPTO_TYPES.SOL]);
    });

    it('should throw error for unsupported crypto game config', () => {
      expect(() => getCryptoGameConfig('INVALID')).to.throw('No game configuration found for cryptocurrency: INVALID');
    });
  });

  describe('Formatters', () => {
    it('should format ETH amounts correctly', () => {
      const { formatAmount } = ETH_CONFIG.formatters;
      
      expect(formatAmount('1.0')).to.equal('1.000');
      expect(formatAmount('0.0001')).to.equal('0.0001');
      expect(formatAmount('0.123456')).to.equal('0.123');
    });

    it('should format ETH addresses correctly', () => {
      const { formatAddress } = ETH_CONFIG.formatters;
      const address = '0x1234567890123456789012345678901234567890';
      
      expect(formatAddress(address)).to.equal('0x1234...7890');
      expect(formatAddress('')).to.equal('');
      expect(formatAddress(null)).to.equal('');
    });

    it('should format SOL amounts correctly', () => {
      const { formatAmount } = SOL_CONFIG.formatters;
      
      expect(formatAmount('1.0')).to.equal('1.000');
      expect(formatAmount('0.0001')).to.equal('0.0001');
      expect(formatAmount('0.123456')).to.equal('0.123');
    });

    it('should format SOL addresses correctly', () => {
      const { formatAddress } = SOL_CONFIG.formatters;
      const address = '11111111111111111111111111111111';
      
      expect(formatAddress(address)).to.equal('1111...1111');
      expect(formatAddress('')).to.equal('');
      expect(formatAddress(null)).to.equal('');
    });
  });

  describe('Validators', () => {
    it('should validate ETH addresses correctly', () => {
      const { isValidAddress } = ETH_CONFIG.validators;
      
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).to.be.true;
      expect(isValidAddress('0x1234567890123456789012345678901234567890'.toLowerCase())).to.be.true;
      expect(isValidAddress('0x1234567890123456789012345678901234567890'.toUpperCase())).to.be.true;
      expect(isValidAddress('1234567890123456789012345678901234567890')).to.be.false; // Missing 0x
      expect(isValidAddress('0x123')).to.be.false; // Too short
      expect(isValidAddress('')).to.be.false;
      expect(isValidAddress(null)).to.be.false;
    });

    it('should validate SOL addresses correctly', () => {
      const { isValidAddress } = SOL_CONFIG.validators;
      
      expect(isValidAddress('11111111111111111111111111111111')).to.be.true;
      expect(isValidAddress('So11111111111111111111111111111111111111112')).to.be.true;
      expect(isValidAddress('123')).to.be.false; // Too short
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).to.be.false; // ETH format
      expect(isValidAddress('')).to.be.false;
      expect(isValidAddress(null)).to.be.false;
    });

    it('should validate amounts correctly', () => {
      const { isValidAmount: ethValidAmount } = ETH_CONFIG.validators;
      const { isValidAmount: solValidAmount } = SOL_CONFIG.validators;
      
      // Both should have same validation logic
      expect(ethValidAmount('1.0')).to.be.true;
      expect(ethValidAmount('0.001')).to.be.true;
      expect(ethValidAmount(1.5)).to.be.true;
      expect(ethValidAmount('0')).to.be.false;
      expect(ethValidAmount('-1')).to.be.false;
      expect(ethValidAmount('invalid')).to.be.false;
      expect(ethValidAmount('')).to.be.false;
      expect(ethValidAmount(null)).to.be.false;

      expect(solValidAmount('1.0')).to.be.true;
      expect(solValidAmount('0.001')).to.be.true;
      expect(solValidAmount(1.5)).to.be.true;
      expect(solValidAmount('0')).to.be.false;
      expect(solValidAmount('-1')).to.be.false;
    });
  });
});