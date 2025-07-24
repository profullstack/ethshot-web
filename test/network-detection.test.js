// Test for network detection functionality
// Testing framework: Mocha with Chai

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

// Mock window.ethereum for testing
const mockEthereum = {
  chainId: '0x1', // Mainnet by default
  request: async (params) => {
    if (params.method === 'eth_chainId') {
      return mockEthereum.chainId;
    }
    if (params.method === 'wallet_switchEthereumChain') {
      mockEthereum.chainId = params.params[0].chainId;
      return null;
    }
    if (params.method === 'wallet_addEthereumChain') {
      mockEthereum.chainId = params.params[0].chainId;
      return null;
    }
    throw new Error(`Unsupported method: ${params.method}`);
  }
};

// Mock the network detection module
const createNetworkDetection = () => {
  const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
  const MAINNET_CHAIN_ID = '0x1'; // 1 in hex

  const getCurrentChainId = async () => {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }
    return await window.ethereum.request({ method: 'eth_chainId' });
  };

  const isCorrectNetwork = async () => {
    try {
      const chainId = await getCurrentChainId();
      return chainId === SEPOLIA_CHAIN_ID;
    } catch (error) {
      return false;
    }
  };

  const switchToSepolia = async () => {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      return true;
    } catch (switchError) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Testnet',
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.infura.io/v3/'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/'],
          }],
        });
        return true;
      }
      throw switchError;
    }
  };

  return {
    getCurrentChainId,
    isCorrectNetwork,
    switchToSepolia,
    SEPOLIA_CHAIN_ID,
    MAINNET_CHAIN_ID
  };
};

describe('Network Detection', () => {
  let networkDetection;

  beforeEach(() => {
    // Setup mock window.ethereum
    global.window = { ethereum: mockEthereum };
    networkDetection = createNetworkDetection();
    // Reset to mainnet for each test
    mockEthereum.chainId = '0x1';
  });

  describe('getCurrentChainId', () => {
    it('should return current chain ID', async () => {
      const chainId = await networkDetection.getCurrentChainId();
      expect(chainId).to.equal('0x1');
    });

    it('should throw error when no wallet detected', async () => {
      global.window.ethereum = null;
      
      try {
        await networkDetection.getCurrentChainId();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('No wallet detected');
      }
    });
  });

  describe('isCorrectNetwork', () => {
    it('should return false when on mainnet', async () => {
      mockEthereum.chainId = '0x1'; // Mainnet
      const isCorrect = await networkDetection.isCorrectNetwork();
      expect(isCorrect).to.be.false;
    });

    it('should return true when on Sepolia', async () => {
      mockEthereum.chainId = '0xaa36a7'; // Sepolia
      const isCorrect = await networkDetection.isCorrectNetwork();
      expect(isCorrect).to.be.true;
    });

    it('should return false when wallet not available', async () => {
      global.window.ethereum = null;
      const isCorrect = await networkDetection.isCorrectNetwork();
      expect(isCorrect).to.be.false;
    });
  });

  describe('switchToSepolia', () => {
    it('should switch to Sepolia network', async () => {
      mockEthereum.chainId = '0x1'; // Start on mainnet
      
      const result = await networkDetection.switchToSepolia();
      
      expect(result).to.be.true;
      expect(mockEthereum.chainId).to.equal('0xaa36a7');
    });

    it('should add Sepolia network if not exists', async () => {
      // Mock the 4902 error (network not added)
      const originalRequest = mockEthereum.request;
      let switchAttempted = false;
      
      mockEthereum.request = async (params) => {
        if (params.method === 'wallet_switchEthereumChain' && !switchAttempted) {
          switchAttempted = true;
          const error = new Error('Network not found');
          error.code = 4902;
          throw error;
        }
        return originalRequest(params);
      };

      const result = await networkDetection.switchToSepolia();
      
      expect(result).to.be.true;
      expect(mockEthereum.chainId).to.equal('0xaa36a7');
      
      // Restore original request
      mockEthereum.request = originalRequest;
    });

    it('should throw error when no wallet detected', async () => {
      global.window.ethereum = null;
      
      try {
        await networkDetection.switchToSepolia();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('No wallet detected');
      }
    });
  });
});