// Cryptocurrency adapter factory and manager
// Provides a unified interface for creating and managing crypto adapters

import { EthereumAdapter } from './ethereum.js';
import { SolanaAdapter } from './solana.js';
import { CRYPTO_TYPES, getCryptoConfig } from '../config.js';

/**
 * Registry of available crypto adapters
 */
const ADAPTER_REGISTRY = {
  [CRYPTO_TYPES.ETH]: EthereumAdapter,
  [CRYPTO_TYPES.SOL]: SolanaAdapter
};

/**
 * Crypto adapter factory
 * Creates and manages cryptocurrency adapters
 */
export class CryptoAdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.activeAdapter = null;
  }

  /**
   * Create a crypto adapter for the specified cryptocurrency
   * @param {string} cryptoType - Type of cryptocurrency (ETH, SOL, etc.)
   * @returns {BaseCryptoAdapter} Crypto adapter instance
   */
  createAdapter(cryptoType) {
    // Check if adapter already exists
    if (this.adapters.has(cryptoType)) {
      return this.adapters.get(cryptoType);
    }

    // Get adapter class from registry
    const AdapterClass = ADAPTER_REGISTRY[cryptoType];
    if (!AdapterClass) {
      throw new Error(`No adapter found for cryptocurrency type: ${cryptoType}`);
    }

    // Get crypto configuration
    const config = getCryptoConfig(cryptoType);

    // Create adapter instance
    const adapter = new AdapterClass(config);

    // Store in registry
    this.adapters.set(cryptoType, adapter);

    return adapter;
  }

  /**
   * Get existing adapter for cryptocurrency type
   * @param {string} cryptoType - Type of cryptocurrency
   * @returns {BaseCryptoAdapter|null} Adapter instance or null if not found
   */
  getAdapter(cryptoType) {
    return this.adapters.get(cryptoType) || null;
  }

  /**
   * Set the active cryptocurrency adapter
   * @param {string} cryptoType - Type of cryptocurrency to set as active
   * @returns {BaseCryptoAdapter} Active adapter instance
   */
  setActiveAdapter(cryptoType) {
    const adapter = this.createAdapter(cryptoType);
    this.activeAdapter = adapter;
    return adapter;
  }

  /**
   * Get the currently active adapter
   * @returns {BaseCryptoAdapter|null} Active adapter or null if none set
   */
  getActiveAdapter() {
    return this.activeAdapter;
  }

  /**
   * Initialize an adapter
   * @param {string} cryptoType - Type of cryptocurrency
   * @returns {Promise<BaseCryptoAdapter>} Initialized adapter
   */
  async initializeAdapter(cryptoType) {
    const adapter = this.createAdapter(cryptoType);
    await adapter.init();
    return adapter;
  }

  /**
   * Disconnect all adapters
   * @returns {Promise<void>}
   */
  async disconnectAll() {
    const disconnectPromises = Array.from(this.adapters.values()).map(adapter => {
      if (adapter.connected) {
        return adapter.disconnect();
      }
      return Promise.resolve();
    });

    await Promise.all(disconnectPromises);
    this.activeAdapter = null;
  }

  /**
   * Get all supported cryptocurrency types
   * @returns {string[]} Array of supported crypto types
   */
  getSupportedCryptos() {
    return Object.keys(ADAPTER_REGISTRY);
  }

  /**
   * Check if a cryptocurrency type is supported
   * @param {string} cryptoType - Type of cryptocurrency to check
   * @returns {boolean} True if supported
   */
  isSupported(cryptoType) {
    return cryptoType in ADAPTER_REGISTRY;
  }

  /**
   * Remove adapter from registry
   * @param {string} cryptoType - Type of cryptocurrency
   * @returns {Promise<void>}
   */
  async removeAdapter(cryptoType) {
    const adapter = this.adapters.get(cryptoType);
    if (adapter) {
      if (adapter.connected) {
        await adapter.disconnect();
      }
      this.adapters.delete(cryptoType);
      
      if (this.activeAdapter === adapter) {
        this.activeAdapter = null;
      }
    }
  }

  /**
   * Get adapter status information
   * @returns {Object} Status information for all adapters
   */
  getStatus() {
    const status = {};
    
    for (const [cryptoType, adapter] of this.adapters) {
      status[cryptoType] = {
        connected: adapter.connected,
        initialized: adapter.provider !== null,
        isActive: this.activeAdapter === adapter
      };
    }

    return status;
  }
}

/**
 * Global crypto adapter factory instance
 */
export const cryptoAdapterFactory = new CryptoAdapterFactory();

/**
 * Convenience functions for common operations
 */

/**
 * Get or create adapter for cryptocurrency type
 * @param {string} cryptoType - Type of cryptocurrency
 * @returns {BaseCryptoAdapter} Adapter instance
 */
export const getAdapter = (cryptoType) => {
  return cryptoAdapterFactory.createAdapter(cryptoType);
};

/**
 * Get the active adapter
 * @returns {BaseCryptoAdapter|null} Active adapter or null
 */
export const getActiveAdapter = () => {
  return cryptoAdapterFactory.getActiveAdapter();
};

/**
 * Set active cryptocurrency
 * @param {string} cryptoType - Type of cryptocurrency to set as active
 * @returns {BaseCryptoAdapter} Active adapter instance
 */
export const setActiveCrypto = (cryptoType) => {
  return cryptoAdapterFactory.setActiveAdapter(cryptoType);
};

/**
 * Initialize and set active cryptocurrency
 * @param {string} cryptoType - Type of cryptocurrency
 * @returns {Promise<BaseCryptoAdapter>} Initialized and active adapter
 */
export const initializeActiveCrypto = async (cryptoType) => {
  const adapter = await cryptoAdapterFactory.initializeAdapter(cryptoType);
  cryptoAdapterFactory.setActiveAdapter(cryptoType);
  return adapter;
};

/**
 * Connect to wallet for active cryptocurrency
 * @param {string} walletType - Type of wallet to connect to
 * @returns {Promise<{address: string, chainId?: number}>} Connection result
 */
export const connectActiveWallet = async (walletType) => {
  const adapter = getActiveAdapter();
  if (!adapter) {
    throw new Error('No active cryptocurrency adapter set');
  }
  
  return await adapter.connect(walletType);
};

/**
 * Disconnect active wallet
 * @returns {Promise<void>}
 */
export const disconnectActiveWallet = async () => {
  const adapter = getActiveAdapter();
  if (adapter) {
    await adapter.disconnect();
  }
};

/**
 * Get supported cryptocurrencies
 * @returns {string[]} Array of supported crypto types
 */
export const getSupportedCryptos = () => {
  return cryptoAdapterFactory.getSupportedCryptos();
};

// Export adapter classes for direct use if needed
export { EthereumAdapter, SolanaAdapter };

// Export crypto types for convenience
export { CRYPTO_TYPES } from '../config.js';