// Network detection utility for ETH Shot
// Handles wallet network detection and switching for configured network

import { NETWORK_CONFIG } from '../config.js';

// Convert decimal chain ID to hex format
const toHex = (chainId) => `0x${parseInt(chainId).toString(16)}`;

// Dynamic network configuration based on NETWORK_CONFIG
const NETWORK_WALLET_CONFIG = {
  chainId: toHex(NETWORK_CONFIG.CHAIN_ID),
  chainName: NETWORK_CONFIG.NETWORK_NAME,
  nativeCurrency: {
    name: NETWORK_CONFIG.CHAIN_ID === 1 ? 'Ether' : `${NETWORK_CONFIG.NETWORK_NAME} ETH`,
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [NETWORK_CONFIG.RPC_URL],
  blockExplorerUrls: [NETWORK_CONFIG.BLOCK_EXPLORER_URL],
};

/**
 * Get the current chain ID from the user's wallet
 * @returns {Promise<string>} Current chain ID in hex format
 * @throws {Error} If no wallet is detected
 */
export const getCurrentChainId = async () => {
  if (!window?.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
  }

  try {
    const chainId = await window.ethereum.request({ 
      method: 'eth_chainId' 
    });
    return chainId;
  } catch (error) {
    throw new Error(`Failed to get chain ID: ${error.message}`);
  }
};

/**
 * Check if the user is connected to the correct network (Sepolia)
 * @returns {Promise<boolean>} True if on correct network, false otherwise
 */
export const isCorrectNetwork = async () => {
  try {
    const currentChainId = await getCurrentChainId();
    const expectedChainId = toHex(NETWORK_CONFIG.CHAIN_ID);
    return currentChainId === expectedChainId;
  } catch (error) {
    console.warn('Network check failed:', error.message);
    return false;
  }
};

/**
 * Get human-readable network name from chain ID
 * @param {string} chainId - Chain ID in hex format
 * @returns {string} Network name
 */
export const getNetworkName = (chainId) => {
  const networks = {
    '0x1': 'Ethereum Mainnet',
    '0xaa36a7': 'Sepolia Testnet',
    '0x89': 'Polygon Mainnet',
    '0x2105': 'Base Mainnet',
    '0xa4b1': 'Arbitrum One',
  };
  
  return networks[chainId] || `Unknown Network (${chainId})`;
};

/**
 * Switch the user's wallet to the configured network
 * @returns {Promise<boolean>} True if switch was successful
 * @throws {Error} If wallet is not available or switch fails
 */
export const switchToNetwork = async () => {
  if (!window?.ethereum) {
    throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
  }

  const targetChainId = toHex(NETWORK_CONFIG.CHAIN_ID);

  try {
    // First, try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    });
    
    return true;
  } catch (switchError) {
    // If the network doesn't exist in the wallet (error code 4902), add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [NETWORK_WALLET_CONFIG],
        });
        return true;
      } catch (addError) {
        throw new Error(`Failed to add ${NETWORK_CONFIG.NETWORK_NAME}: ${addError.message}`);
      }
    } else {
      throw new Error(`Failed to switch network: ${switchError.message}`);
    }
  }
};

// Backward compatibility alias
export const switchToSepolia = switchToNetwork;

/**
 * Listen for network changes and execute callback
 * @param {Function} callback - Function to call when network changes
 * @returns {Function} Cleanup function to remove listener
 */
export const onNetworkChange = (callback) => {
  if (!window?.ethereum) {
    console.warn('No wallet detected for network change listener');
    return () => {}; // Return empty cleanup function
  }

  const handleChainChanged = (chainId) => {
    console.log('Network changed to:', getNetworkName(chainId));
    callback(chainId);
  };

  window.ethereum.on('chainChanged', handleChainChanged);

  // Return cleanup function
  return () => {
    if (window?.ethereum?.removeListener) {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };
};

/**
 * Get network status information
 * @returns {Promise<Object>} Network status object
 */
export const getNetworkStatus = async () => {
  try {
    const currentChainId = await getCurrentChainId();
    const isCorrect = await isCorrectNetwork();
    const currentNetworkName = getNetworkName(currentChainId);
    const expectedNetworkName = NETWORK_CONFIG.NETWORK_NAME;

    return {
      currentChainId,
      currentNetworkName,
      expectedChainId: toHex(NETWORK_CONFIG.CHAIN_ID),
      expectedNetworkName,
      isCorrectNetwork: isCorrect,
      hasWallet: !!window?.ethereum,
    };
  } catch (error) {
    return {
      currentChainId: null,
      currentNetworkName: 'Unknown',
      expectedChainId: toHex(NETWORK_CONFIG.CHAIN_ID),
      expectedNetworkName: NETWORK_CONFIG.NETWORK_NAME,
      isCorrectNetwork: false,
      hasWallet: !!window?.ethereum,
      error: error.message,
    };
  }
};

/**
 * Check if user needs to get testnet ETH
 * @returns {Object} Information about getting testnet ETH
 */
export const getTestnetInfo = () => {
  // Return different info based on network
  if (NETWORK_CONFIG.CHAIN_ID === 1) {
    return {
      faucetUrl: null,
      alternativeFaucets: [],
      instructions: [
        'You are on Ethereum Mainnet',
        'You need real ETH to play',
        'Purchase ETH from an exchange like Coinbase, Binance, or Kraken',
        'Transfer ETH to your wallet',
        'Return to ETH Shot to start playing!',
      ],
    };
  }
  
  // Sepolia testnet info
  if (NETWORK_CONFIG.CHAIN_ID === 11155111) {
    return {
      faucetUrl: 'https://sepoliafaucet.com',
      alternativeFaucets: [
        'https://sepolia-faucet.pk910.de',
        'https://www.alchemy.com/faucets/ethereum-sepolia',
      ],
      instructions: [
        'Visit a Sepolia faucet website',
        'Connect your wallet',
        'Request testnet ETH (usually 0.5 ETH per day)',
        'Wait for the transaction to complete',
        'Return to ETH Shot to start playing!',
      ],
    };
  }
  
  // Generic testnet info
  return {
    faucetUrl: null,
    alternativeFaucets: [],
    instructions: [
      `You are on ${NETWORK_CONFIG.NETWORK_NAME}`,
      'You may need testnet ETH to play',
      'Look for faucets specific to this network',
      'Connect your wallet to the faucet',
      'Request testnet ETH',
      'Return to ETH Shot to start playing!',
    ],
  };
};