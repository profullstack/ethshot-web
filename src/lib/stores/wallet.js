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
      const ethersModule = await import('ethers');
      ethers = ethersModule;

      if (!ethers) {
        throw new Error('Failed to load ethers library');
      }

      // For now, we'll focus on direct MetaMask connection
      // Web3Modal v1.x has compatibility issues with ethers v6
      console.log('Using direct wallet connection (MetaMask/injected providers)');
      
      // Check if user was previously connected via localStorage
      const wasConnected = localStorage.getItem('wallet_connected') === 'true';
      if (wasConnected && window.ethereum) {
        console.log('Previous wallet connection found, ready to reconnect');
      }

    } catch (error) {
      console.error('Failed to initialize Web3 libraries:', error);
      const errorMessage = 'Wallet libraries not fully available. MetaMask direct connection may still work.';
      update(state => ({ ...state, error: errorMessage }));
      // Don't throw error - allow fallback to MetaMask
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
      if (!ethers) {
        await init();
      }

      if (!ethers) {
        throw new Error('Ethers library not available. Please refresh and try again.');
      }

      let instance;

      // Handle different wallet connection types
      if (walletType === 'injected' || walletType === 'auto') {
        // Check for injected wallet first
        if (window.ethereum) {
          try {
            console.log('🔗 Requesting injected wallet connection...');
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            console.log('✅ Injected wallet connected:', accounts[0]);
            instance = window.ethereum;
          } catch (metamaskError) {
            console.error('❌ Injected wallet connection failed:', metamaskError);
            console.error('❌ Error details:', {
              message: metamaskError.message,
              code: metamaskError.code,
              stack: metamaskError.stack
            });
            if (walletType === 'injected') {
              throw new Error('Injected wallet connection failed: ' + metamaskError.message);
            }
            // If auto mode and injected fails, don't try WalletConnect on desktop
            if (walletType === 'auto') {
              throw new Error('Browser wallet connection failed: ' + metamaskError.message);
            }
          }
        } else {
          // No window.ethereum detected
          if (walletType === 'injected') {
            throw new Error('No browser wallet found. Please install MetaMask or another Web3 wallet.');
          } else if (walletType === 'auto') {
            // Auto mode but no window.ethereum - provide helpful message
            throw new Error('No browser wallet found. Please install MetaMask or another Web3 wallet.');
          }
        }
      }

      // Only try WalletConnect if specifically requested
      if (!instance && walletType === 'walletconnect') {
        try {
          console.log('🔗 Initializing WalletConnect...');
          
          // Check if WalletConnect Project ID is configured
          if (!WALLET_CONFIG.WALLETCONNECT_PROJECT_ID) {
            throw new Error('WalletConnect Project ID not configured. Please set VITE_WALLETCONNECT_PROJECT_ID in your environment variables.');
          }

          // Dynamic import for WalletConnect
          const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
          
          const walletConnectProvider = await EthereumProvider.init({
            projectId: WALLET_CONFIG.WALLETCONNECT_PROJECT_ID,
            chains: [NETWORK_CONFIG.CHAIN_ID],
            rpcMap: {
              [NETWORK_CONFIG.CHAIN_ID]: NETWORK_CONFIG.RPC_URL
            },
            metadata: {
              name: 'ETH Shot',
              description: 'A viral, pay-to-play, Ethereum-powered game',
              url: 'https://ethshot.io',
              icons: ['https://ethshot.io/favicon.png']
            }
          });

          console.log('🔗 Requesting WalletConnect connection...');
          await walletConnectProvider.connect();
          console.log('✅ WalletConnect connected');
          instance = walletConnectProvider;
          
        } catch (walletConnectError) {
          console.error('❌ WalletConnect connection failed:', walletConnectError);
          throw new Error('WalletConnect connection failed: ' + walletConnectError.message);
        }
      }

      // Final check for successful connection
      if (!instance) {
        if (walletType === 'auto') {
          throw new Error('No wallet found. Please install MetaMask or another Web3 wallet.');
        } else {
          throw new Error(`Failed to connect ${walletType} wallet.`);
        }
      }

      console.log('🔧 Creating provider and signer...');
      provider = new ethers.BrowserProvider(instance);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const balance = await provider.getBalance(address);
      const network = await provider.getNetwork();

      console.log('✅ Wallet setup complete:', {
        address,
        chainId: Number(network.chainId),
        balance: ethers.formatEther(balance)
      });

      // Store connection state
      localStorage.setItem('wallet_connected', 'true');

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
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        errorMessage = 'Connection cancelled by user';
      } else if (error.message.includes('No wallet found')) {
        errorMessage = 'No wallet found. Please install MetaMask or another Web3 wallet.';
      } else if (error.message.includes('not available')) {
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

      // Clear localStorage
      localStorage.removeItem('wallet_connected');

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

      console.log('🔌 Wallet disconnected');
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