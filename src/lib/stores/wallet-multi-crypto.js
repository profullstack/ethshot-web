// Multi-cryptocurrency wallet store
// Refactored to support multiple cryptocurrencies using the adapter pattern

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { 
  cryptoAdapterFactory, 
  getActiveAdapter, 
  setActiveCrypto, 
  initializeActiveCrypto,
  CRYPTO_TYPES 
} from '../crypto/adapters/index.js';
import { getCurrentCrypto, getCryptoConfig } from '../crypto/config.js';

// Multi-crypto wallet connection state
const createMultiCryptoWalletStore = () => {
  const { subscribe, set, update } = writable({
    // Connection state
    connected: false,
    address: null,
    balance: '0',
    chainId: null,
    networkName: null,
    
    // Multi-crypto state
    activeCrypto: CRYPTO_TYPES.ETH, // Default to ETH
    supportedCryptos: [CRYPTO_TYPES.ETH], // SOL will be added when implemented
    cryptoConfig: null,
    
    // Wallet state
    walletType: null,
    connecting: false,
    error: null,
    
    // Adapter state
    adapter: null,
    initialized: false
  });

  // Initialize the wallet store
  const init = async (cryptoType = null) => {
    if (!browser) {
      console.warn('Multi-crypto wallet initialization skipped on server');
      return;
    }

    try {
      // Determine which crypto to use
      const targetCrypto = cryptoType || getCurrentCrypto().type;
      
      update(state => ({
        ...state,
        activeCrypto: targetCrypto,
        connecting: true,
        error: null
      }));

      // Initialize the crypto adapter
      const adapter = await initializeActiveCrypto(targetCrypto);
      const cryptoConfig = getCryptoConfig(targetCrypto);

      update(state => ({
        ...state,
        adapter,
        cryptoConfig,
        initialized: true,
        connecting: false,
        supportedCryptos: cryptoAdapterFactory.getSupportedCryptos()
      }));

      // Check if user was previously connected
      const wasConnected = localStorage.getItem(`wallet_connected_${targetCrypto}`) === 'true';
      if (wasConnected) {
        console.log(`Previous ${targetCrypto} wallet connection found, ready to reconnect`);
      }

      console.log(`Multi-crypto wallet store initialized for ${targetCrypto}`);

    } catch (error) {
      console.error('Failed to initialize multi-crypto wallet:', error);
      
      let errorMessage = `Failed to initialize ${cryptoType || 'wallet'}`;
      if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      }
      
      update(state => ({
        ...state,
        connecting: false,
        error: errorMessage,
        initialized: false
      }));
    }
  };

  // Switch to a different cryptocurrency
  const switchCrypto = async (cryptoType) => {
    if (!browser) {
      console.warn('Crypto switching skipped on server');
      return;
    }

    try {
      update(state => ({
        ...state,
        connecting: true,
        error: null
      }));

      // Disconnect current adapter if connected
      const currentAdapter = getActiveAdapter();
      if (currentAdapter?.connected) {
        await currentAdapter.disconnect();
      }

      // Clear current connection state
      update(state => ({
        ...state,
        connected: false,
        address: null,
        balance: '0',
        chainId: null,
        networkName: null,
        walletType: null
      }));

      // Initialize new crypto adapter
      const adapter = await initializeActiveCrypto(cryptoType);
      const cryptoConfig = getCryptoConfig(cryptoType);

      update(state => ({
        ...state,
        activeCrypto: cryptoType,
        adapter,
        cryptoConfig,
        connecting: false
      }));

      console.log(`Switched to ${cryptoType} cryptocurrency`);

    } catch (error) {
      console.error(`Failed to switch to ${cryptoType}:`, error);
      
      update(state => ({
        ...state,
        connecting: false,
        error: `Failed to switch to ${cryptoType}: ${error.message}`
      }));
      
      throw error;
    }
  };

  // Connect wallet with multiple options
  const connect = async (walletType = 'auto') => {
    if (!browser) {
      console.warn('Wallet connection skipped on server');
      return;
    }

    update(state => ({ ...state, connecting: true, error: null }));

    try {
      const adapter = getActiveAdapter();
      if (!adapter) {
        throw new Error('No active cryptocurrency adapter. Please initialize first.');
      }

      // Connect using the adapter
      const connectionResult = await adapter.connect(walletType);
      
      // Get balance
      const balance = await adapter.getBalance(connectionResult.address);
      
      // Get network name if available
      let networkName = null;
      try {
        const currentNetwork = adapter.getCurrentNetworkConfig();
        networkName = currentNetwork.name;
      } catch (error) {
        console.warn('Could not get network name:', error.message);
      }

      // Store connection state
      const currentState = { subscribe };
      const activeCrypto = currentState.activeCrypto || CRYPTO_TYPES.ETH;
      localStorage.setItem(`wallet_connected_${activeCrypto}`, 'true');
      localStorage.setItem(`wallet_type_${activeCrypto}`, walletType);

      update(state => ({
        ...state,
        connected: true,
        address: connectionResult.address,
        balance,
        chainId: connectionResult.chainId,
        networkName,
        walletType,
        connecting: false,
        error: null
      }));

      // Set up event listeners
      setupEventListeners(adapter);

      console.log(`✅ ${state.activeCrypto} wallet connected:`, {
        address: connectionResult.address,
        chainId: connectionResult.chainId,
        balance,
        walletType
      });

      return connectionResult;

    } catch (error) {
      console.error('Failed to connect wallet:', error);
      
      let errorMessage = 'Failed to connect wallet';
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        errorMessage = 'Connection cancelled by user';
      } else if (error.message.includes('No wallet found')) {
        errorMessage = 'No wallet found. Please install a compatible wallet.';
      } else if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      update(state => ({
        ...state,
        connecting: false,
        error: errorMessage
      }));
      
      throw new Error(errorMessage);
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    try {
      const adapter = getActiveAdapter();
      if (adapter) {
        await adapter.disconnect();
      }

      // Clear localStorage for all cryptos
      Object.values(CRYPTO_TYPES).forEach(cryptoType => {
        localStorage.removeItem(`wallet_connected_${cryptoType}`);
        localStorage.removeItem(`wallet_type_${cryptoType}`);
      });

      update(state => ({
        ...state,
        connected: false,
        address: null,
        balance: '0',
        chainId: null,
        networkName: null,
        walletType: null,
        connecting: false,
        error: null
      }));

      console.log('🔌 Multi-crypto wallet disconnected');

    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Update balance
  const updateBalance = async () => {
    if (!browser) return;

    try {
      const adapter = getActiveAdapter();
      if (!adapter?.connected) return;

      const currentState = { subscribe };
      if (!currentState.address) return;

      const balance = await adapter.getBalance(currentState.address);
      
      update(state => ({
        ...state,
        balance
      }));

    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  };

  // Switch network
  const switchNetwork = async (networkName) => {
    if (!browser) return;

    try {
      const adapter = getActiveAdapter();
      if (!adapter?.connected) {
        throw new Error('No wallet connected');
      }

      await adapter.switchNetwork(networkName);
      
      // Update network name in state
      const networkConfig = adapter.getNetworkConfig(networkName);
      update(state => ({
        ...state,
        networkName: networkConfig.name,
        chainId: networkConfig.chainId
      }));

    } catch (error) {
      console.error('Failed to switch network:', error);
      
      update(state => ({
        ...state,
        error: `Failed to switch network: ${error.message}`
      }));
      
      throw error;
    }
  };

  // Add network
  const addNetwork = async (networkName) => {
    if (!browser) return;

    try {
      const adapter = getActiveAdapter();
      if (!adapter) {
        throw new Error('No active adapter');
      }

      await adapter.addNetwork(networkName);

    } catch (error) {
      console.error('Failed to add network:', error);
      
      update(state => ({
        ...state,
        error: `Failed to add network: ${error.message}`
      }));
      
      throw error;
    }
  };

  // Setup event listeners for wallet events
  const setupEventListeners = (adapter) => {
    if (!adapter) return;

    const onAccountsChanged = async (accounts) => {
      if (Array.isArray(accounts) && accounts.length === 0) {
        await disconnect();
      } else {
        // Refresh connection with new account
        try {
          const address = Array.isArray(accounts) ? accounts[0] : accounts;
          const balance = await adapter.getBalance(address);
          
          update(state => ({
            ...state,
            address,
            balance
          }));
        } catch (error) {
          console.error('Failed to handle account change:', error);
        }
      }
    };

    const onChainChanged = async (chainId) => {
      try {
        // Update chain ID
        const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
        
        update(state => ({
          ...state,
          chainId: numericChainId
        }));

        // Update balance for new chain
        await updateBalance();
      } catch (error) {
        console.error('Failed to handle chain change:', error);
      }
    };

    const onDisconnect = async () => {
      await disconnect();
    };

    // Setup adapter-specific event listeners
    adapter.setupEventListeners(
      adapter.walletInstance,
      onAccountsChanged,
      onChainChanged,
      onDisconnect
    );
  };

  // Get supported wallets for current crypto
  const getSupportedWallets = () => {
    const adapter = getActiveAdapter();
    if (!adapter) return [];

    return adapter.config.walletProviders;
  };

  // Get available networks for current crypto
  const getAvailableNetworks = () => {
    const adapter = getActiveAdapter();
    if (!adapter) return [];

    return Object.keys(adapter.config.networks);
  };

  // Check if wallet type is supported for current crypto
  const isWalletSupported = (walletType) => {
    const adapter = getActiveAdapter();
    if (!adapter) return false;

    return adapter.isWalletSupported(walletType);
  };

  return {
    subscribe,
    init,
    switchCrypto,
    connect,
    disconnect,
    updateBalance,
    switchNetwork,
    addNetwork,
    getSupportedWallets,
    getAvailableNetworks,
    isWalletSupported
  };
};

export const multiCryptoWalletStore = createMultiCryptoWalletStore();

// Derived stores for convenience
export const isConnected = derived(multiCryptoWalletStore, $wallet => $wallet.connected);

export const walletAddress = derived(multiCryptoWalletStore, $wallet => $wallet.address);

export const walletBalance = derived(multiCryptoWalletStore, $wallet => $wallet.balance);

export const walletChainId = derived(multiCryptoWalletStore, $wallet => $wallet.chainId);

export const activeCrypto = derived(multiCryptoWalletStore, $wallet => $wallet.activeCrypto);

export const cryptoConfig = derived(multiCryptoWalletStore, $wallet => $wallet.cryptoConfig);

export const supportedCryptos = derived(multiCryptoWalletStore, $wallet => $wallet.supportedCryptos);

export const walletError = derived(multiCryptoWalletStore, $wallet => $wallet.error);

export const isConnecting = derived(multiCryptoWalletStore, $wallet => $wallet.connecting);

export const isInitialized = derived(multiCryptoWalletStore, $wallet => $wallet.initialized);

// Network-related derived stores
export const currentNetwork = derived(multiCryptoWalletStore, $wallet => $wallet.networkName);

export const isCorrectNetwork = derived(multiCryptoWalletStore, $wallet => {
  if (!$wallet.cryptoConfig || !$wallet.chainId) return false;
  
  const defaultNetwork = $wallet.cryptoConfig.networks[$wallet.cryptoConfig.defaultNetwork];
  return $wallet.chainId === defaultNetwork?.chainId;
});