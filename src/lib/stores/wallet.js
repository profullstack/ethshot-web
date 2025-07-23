import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { NETWORK_CONFIG, WALLET_CONFIG, RPC_URLS, EXPLORER_URLS } from '../config.js';

// Wallet connection state
const createWalletStore = () => {
  const { subscribe, set, update } = writable({
    connected: false,
    address: null,
    balance: '0',
    chainId: null,
    provider: null,
    signer: null,
    connecting: false,
    error: null,
  });

  let web3Modal = null;
  let provider = null;
  let ethers = null;
  let Web3Modal = null;
  let WalletConnectProvider = null;

  // Initialize Web3Modal (browser only)
  const init = async () => {
    if (!browser) {
      console.warn('Web3Modal initialization skipped on server');
      return;
    }

    try {
      // Dynamic imports for browser-only libraries
      const [ethersModule, web3ModalModule, walletConnectModule] = await Promise.all([
        import('ethers'),
        import('web3modal'),
        import('@walletconnect/web3-provider')
      ]);

      ethers = ethersModule;
      Web3Modal = web3ModalModule.default;
      WalletConnectProvider = walletConnectModule.default;

      if (!ethers || !Web3Modal || !WalletConnectProvider) {
        throw new Error('Failed to load required Web3 libraries');
      }

      const providerOptions = {
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            infuraId: WALLET_CONFIG.INFURA_PROJECT_ID,
            rpc: {
              1: RPC_URLS.MAINNET,
              11155111: RPC_URLS.SEPOLIA,
            },
          },
        },
      };

      web3Modal = new Web3Modal({
        network: 'mainnet',
        cacheProvider: WALLET_CONFIG.WALLETCONNECT_CACHE_PROVIDER,
        providerOptions,
        theme: WALLET_CONFIG.WALLETCONNECT_THEME,
      });

      if (!web3Modal) {
        throw new Error('Failed to initialize Web3Modal');
      }

      // Check if user was previously connected
      if (web3Modal.cachedProvider) {
        // Don't auto-connect on init to avoid errors, let user manually connect
        console.log('Previous wallet connection found, ready to reconnect');
      }
    } catch (error) {
      console.error('Failed to initialize Web3Modal:', error);
      const errorMessage = error.message || 'Failed to initialize wallet libraries';
      update(state => ({ ...state, error: errorMessage }));
      throw new Error(errorMessage);
    }
  };

  // Connect wallet
  const connect = async () => {
    if (!browser) {
      console.warn('Wallet connection skipped on server');
      return;
    }

    update(state => ({ ...state, connecting: true, error: null }));

    try {
      if (!web3Modal) {
        await init();
      }

      if (!web3Modal || !ethers) {
        throw new Error('Web3 libraries not initialized. Please check your environment configuration.');
      }

      const instance = await web3Modal.connect();
      
      if (!instance) {
        throw new Error('Failed to get wallet provider instance');
      }

      provider = new ethers.BrowserProvider(instance);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const network = await provider.getNetwork();

      update(state => ({
        ...state,
        connected: true,
        address,
        balance: ethers.formatEther(balance),
        chainId: Number(network.chainId),
        provider,
        signer,
        connecting: false,
        error: null,
      }));

      // Set up event listeners
      setupEventListeners(instance);

      return { address, chainId: Number(network.chainId) };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      
      let errorMessage = 'Failed to connect wallet';
      if (error.message.includes('User rejected')) {
        errorMessage = 'Connection cancelled by user';
      } else if (error.message.includes('not initialized')) {
        errorMessage = 'Wallet libraries not loaded. Please refresh and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      update(state => ({
        ...state,
        connecting: false,
        error: errorMessage,
      }));
      
      throw new Error(errorMessage);
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    try {
      if (web3Modal) {
        web3Modal.clearCachedProvider();
      }

      if (provider?.connection?.close) {
        await provider.connection.close();
      }

      set({
        connected: false,
        address: null,
        balance: '0',
        chainId: null,
        provider: null,
        signer: null,
        connecting: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Setup event listeners for wallet events
  const setupEventListeners = instance => {
    if (!instance) return;

    instance.on('accountsChanged', async accounts => {
      if (accounts.length === 0) {
        await disconnect();
      } else {
        // Refresh connection with new account
        await connect();
      }
    });

    instance.on('chainChanged', async chainId => {
      // Refresh connection with new chain
      await connect();
    });

    instance.on('disconnect', async () => {
      await disconnect();
    });
  };

  // Update balance
  const updateBalance = async () => {
    if (!browser || !ethers) {
      return;
    }

    update(state => {
      if (!state.connected || !state.provider || !state.address) {
        return state;
      }

      state.provider
        .getBalance(state.address)
        .then(balance => {
          update(currentState => ({
            ...currentState,
            balance: ethers.formatEther(balance),
          }));
        })
        .catch(error => {
          console.error('Failed to update balance:', error);
        });

      return state;
    });
  };

  // Switch network
  const switchNetwork = async targetChainId => {
    if (!browser) {
      return;
    }

    update(state => {
      if (!state.provider || !window.ethereum) {
        return { ...state, error: 'No wallet connected' };
      }

      const chainIdHex = `0x${targetChainId.toString(16)}`;

      window.ethereum
        .request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
        .catch(error => {
          console.error('Failed to switch network:', error);
          update(currentState => ({
            ...currentState,
            error: `Failed to switch to network ${targetChainId}`,
          }));
        });

      return state;
    });
  };

  // Add network
  const addNetwork = async networkConfig => {
    if (!browser) {
      return;
    }

    update(state => {
      if (!window.ethereum) {
        return { ...state, error: 'No wallet connected' };
      }

      window.ethereum
        .request({
          method: 'wallet_addEthereumChain',
          params: [networkConfig],
        })
        .catch(error => {
          console.error('Failed to add network:', error);
          update(currentState => ({
            ...currentState,
            error: 'Failed to add network',
          }));
        });

      return state;
    });
  };

  return {
    subscribe,
    init,
    connect,
    disconnect,
    updateBalance,
    switchNetwork,
    addNetwork,
  };
};

export const walletStore = createWalletStore();

// Derived stores for convenience
export const isConnected = derived(walletStore, $wallet => $wallet.connected);

export const walletAddress = derived(walletStore, $wallet => $wallet.address);

export const walletBalance = derived(walletStore, $wallet => $wallet.balance);

export const walletChainId = derived(walletStore, $wallet => $wallet.chainId);

export const walletSigner = derived(walletStore, $wallet => $wallet.signer);

export const isCorrectNetwork = derived(walletStore, $wallet => {
  return $wallet.chainId === NETWORK_CONFIG.CHAIN_ID;
});

// Network configurations
export const NETWORKS = {
  1: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.infura.io/v3/demo'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  11155111: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia Testnet',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18,
    },
    rpcUrls: ['https://sepolia.infura.io/v3/demo'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  8453: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  42161: {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
};