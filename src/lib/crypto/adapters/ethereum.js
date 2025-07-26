// Ethereum cryptocurrency adapter
// Implements the BaseCryptoAdapter interface for Ethereum-based interactions

import { BaseCryptoAdapter } from './base.js';
import { WALLET_PROVIDERS } from '../config.js';

/**
 * Ethereum adapter for handling ETH transactions and wallet interactions
 */
export class EthereumAdapter extends BaseCryptoAdapter {
  constructor(config) {
    super(config);
    this.ethers = null;
    this.contract = null;
    this.walletInstance = null;
  }

  /**
   * Initialize the Ethereum adapter with ethers.js
   */
  async init() {
    if (typeof window === 'undefined') {
      console.warn('Ethereum adapter initialization skipped on server');
      return;
    }

    try {
      // Dynamic import for browser-only ethers library
      const ethersModule = await import('ethers');
      this.ethers = ethersModule;

      if (!this.ethers) {
        throw new Error('Failed to load ethers library');
      }

      console.log('Ethereum adapter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Ethereum adapter:', error);
      throw new Error(`Ethereum adapter initialization failed: ${error.message}`);
    }
  }

  /**
   * Connect to an Ethereum wallet
   */
  async connect(walletType = 'auto') {
    if (!this.ethers) {
      await this.init();
    }

    if (!this.ethers) {
      throw new Error('Ethers library not available. Please refresh and try again.');
    }

    let instance;

    try {
      // Handle different wallet connection types
      if (walletType === 'injected' || walletType === 'auto') {
        if (window.ethereum) {
          console.log('🔗 Requesting injected wallet connection...');
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          console.log('✅ Injected wallet connected:', accounts[0]);
          instance = window.ethereum;
        } else {
          throw new Error('No browser wallet found. Please install MetaMask or another Web3 wallet.');
        }
      }

      // WalletConnect support
      if (!instance && walletType === 'walletconnect') {
        console.log('🔗 Initializing WalletConnect...');
        
        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
        if (!projectId) {
          throw new Error('WalletConnect Project ID not configured.');
        }

        const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
        
        const currentNetwork = this.getCurrentNetworkConfig();
        const walletConnectProvider = await EthereumProvider.init({
          projectId,
          chains: [currentNetwork.chainId],
          rpcMap: {
            [currentNetwork.chainId]: currentNetwork.rpcUrl
          },
          metadata: {
            name: 'ETH Shot',
            description: 'A viral, pay-to-play, Ethereum-powered game',
            url: 'https://ethshot.io',
            icons: ['https://ethshot.io/favicon.png']
          }
        });

        await walletConnectProvider.connect();
        console.log('✅ WalletConnect connected');
        instance = walletConnectProvider;
      }

      if (!instance) {
        throw new Error(`Failed to connect ${walletType} wallet.`);
      }

      // Create provider and signer
      this.provider = new this.ethers.BrowserProvider(instance);
      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();

      // Store wallet instance for event listeners
      this.walletInstance = instance;
      this.connected = true;

      console.log('✅ Ethereum wallet setup complete:', {
        address,
        chainId: Number(network.chainId),
        balance: await this.getBalance(address)
      });

      return { 
        address, 
        chainId: Number(network.chainId) 
      };

    } catch (error) {
      console.error('Failed to connect Ethereum wallet:', error);
      
      let errorMessage = 'Failed to connect wallet';
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        errorMessage = 'Connection cancelled by user';
      } else if (error.message.includes('No wallet found')) {
        errorMessage = 'No wallet found. Please install MetaMask or another Web3 wallet.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Disconnect from Ethereum wallet
   */
  async disconnect() {
    try {
      if (this.provider?.connection?.close) {
        await this.provider.connection.close();
      }

      this.provider = null;
      this.signer = null;
      this.contract = null;
      this.walletInstance = null;
      this.connected = false;

      console.log('🔌 Ethereum wallet disconnected');
    } catch (error) {
      console.error('Failed to disconnect Ethereum wallet:', error);
    }
  }

  /**
   * Get wallet balance in ETH
   */
  async getBalance(address) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const balance = await this.provider.getBalance(address);
    return this.ethers.formatEther(balance);
  }

  /**
   * Switch to a different Ethereum network
   */
  async switchNetwork(networkName) {
    if (!this.walletInstance || !window.ethereum) {
      throw new Error('No wallet connected');
    }

    const networkConfig = this.getNetworkConfig(networkName);
    const chainIdHex = networkConfig.chainIdHex;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (error) {
      console.error('Failed to switch network:', error);
      throw new Error(`Failed to switch to ${networkConfig.name}`);
    }
  }

  /**
   * Add a new Ethereum network to wallet
   */
  async addNetwork(networkName) {
    if (!window.ethereum) {
      throw new Error('No wallet connected');
    }

    const networkConfig = this.getNetworkConfig(networkName);

    const networkParams = {
      chainId: networkConfig.chainIdHex,
      chainName: networkConfig.name,
      nativeCurrency: networkConfig.nativeCurrency,
      rpcUrls: [networkConfig.rpcUrl],
      blockExplorerUrls: [networkConfig.explorerUrl]
    };

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkParams],
      });
    } catch (error) {
      console.error('Failed to add network:', error);
      throw new Error(`Failed to add ${networkConfig.name} network`);
    }
  }

  /**
   * Get contract instance
   */
  getContract() {
    if (!this.contract) {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const contractAddress = this.config.contractConfig.address;
      if (!contractAddress) {
        throw new Error('Contract address not configured');
      }

      this.contract = new this.ethers.Contract(
        contractAddress,
        this.config.contractConfig.abi,
        this.provider
      );
    }

    return this.contract;
  }

  /**
   * Generate a cryptographically secure secret for commit-reveal
   */
  generateSecret() {
    return this.ethers.hexlify(this.ethers.randomBytes(32));
  }

  /**
   * Generate commitment hash from secret and player address
   */
  generateCommitment(secret, playerAddress) {
    return this.ethers.keccak256(
      this.ethers.solidityPacked(
        ['uint256', 'address'],
        [secret, playerAddress]
      )
    );
  }

  /**
   * Commit a shot with generated commitment
   */
  async commitShot(commitment, shotCost = null) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);

    // Get shot cost if not provided
    const actualShotCost = shotCost || await contract.SHOT_COST();
    
    // Estimate gas for commitShot
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.commitShot.estimateGas(commitment, {
        value: actualShotCost
      });
    } catch (estimateError) {
      console.warn('Failed to estimate gas for commitShot, using default:', estimateError.message);
      gasEstimate = 150000n;
    }

    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate < 120000n ? 150000n : gasEstimate + (gasEstimate * 20n / 100n);

    // Send commitShot transaction
    const tx = await contractWithSigner.commitShot(commitment, {
      value: actualShotCost,
      gasLimit: gasLimit
    });

    console.log('✅ Shot commitment transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    // Check for ShotCommitted event
    const shotCommittedEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'ShotCommitted';
      } catch {
        return false;
      }
    });

    if (!shotCommittedEvent) {
      throw new Error('Shot commitment failed - no ShotCommitted event found');
    }

    const parsed = contract.interface.parseLog(shotCommittedEvent);
    const commitBlock = parsed.args.blockNumber;

    return {
      hash: tx.hash,
      receipt,
      committed: true,
      commitBlock: Number(commitBlock)
    };
  }

  /**
   * Reveal a committed shot
   */
  async revealShot(secret) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Estimate gas for revealShot
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.revealShot.estimateGas(secret);
    } catch (estimateError) {
      console.warn('Failed to estimate gas for revealShot, using default:', estimateError.message);
      gasEstimate = 100000n;
    }

    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);

    // Send revealShot transaction
    const tx = await contractWithSigner.revealShot(secret, {
      gasLimit: gasLimit
    });

    console.log('✅ Shot reveal transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    // Check for ShotRevealed event
    const shotRevealedEvent = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'ShotRevealed';
      } catch {
        return false;
      }
    });

    if (!shotRevealedEvent) {
      throw new Error('Shot reveal failed - no ShotRevealed event found');
    }

    const parsed = contract.interface.parseLog(shotRevealedEvent);
    const won = parsed.args.won;
    const randomNumber = parsed.args.randomNumber;

    // Check for JackpotWon event if player won
    let jackpotAmount = '0';
    if (won) {
      const jackpotEvent = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'JackpotWon';
        } catch {
          return false;
        }
      });
      
      if (jackpotEvent) {
        const jackpotParsed = contract.interface.parseLog(jackpotEvent);
        jackpotAmount = this.ethers.formatEther(jackpotParsed.args.amount);
      }
    }

    return {
      hash: tx.hash,
      receipt,
      won,
      randomNumber: randomNumber.toString(),
      jackpotAmount
    };
  }

  /**
   * Claim failed payout
   */
  async claimPayout() {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Check if user has pending payout
    const pendingPayout = await contractWithSigner.getPendingPayout(this.signer.address);
    if (pendingPayout === 0n) {
      throw new Error('No pending payout to claim');
    }

    // Send claimPayout transaction
    const tx = await contractWithSigner.claimPayout();

    console.log('✅ Payout claim transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    
    const claimedAmount = this.ethers.formatEther(pendingPayout);

    return {
      hash: tx.hash,
      receipt,
      claimedAmount
    };
  }

  /**
   * Sponsor a round
   */
  async sponsorRound(name, logoUrl) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);

    // Get sponsor cost
    const sponsorCost = await contract.SPONSOR_COST();

    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.sponsorRound.estimateGas(name, logoUrl, {
        value: sponsorCost
      });
    } catch (estimateError) {
      console.warn('Failed to estimate gas, using default:', estimateError.message);
      gasEstimate = 100000n;
    }

    // Add 20% buffer to gas estimate
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);

    // Send transaction
    const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
      value: sponsorCost,
      gasLimit: gasLimit
    });

    console.log('✅ Sponsor transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt
    };
  }

  /**
   * Get current pot size
   */
  async getCurrentPot() {
    const contract = this.getContract();
    const pot = await contract.getCurrentPot();
    return this.ethers.formatEther(pot);
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(address) {
    const contract = this.getContract();
    const stats = await contract.getPlayerStats(address);
    
    return {
      totalShots: Number(stats.totalShots),
      totalSpent: this.ethers.formatEther(stats.totalSpent),
      totalWon: this.ethers.formatEther(stats.totalWon),
      lastShotTime: new Date(Number(stats.lastShotTime) * 1000).toISOString()
    };
  }

  /**
   * Check if player can commit a shot
   */
  async canTakeShot(address) {
    const contract = this.getContract();
    return await contract.canCommitShot(address);
  }

  /**
   * Check if player can reveal their shot
   */
  async canRevealShot(address) {
    const contract = this.getContract();
    return await contract.canRevealShot(address);
  }

  /**
   * Check if player has a pending shot
   */
  async hasPendingShot(address) {
    const contract = this.getContract();
    return await contract.hasPendingShot(address);
  }

  /**
   * Get pending shot details for player
   */
  async getPendingShot(address) {
    const contract = this.getContract();
    const result = await contract.getPendingShot(address);
    
    return {
      exists: result.exists,
      blockNumber: Number(result.blockNumber),
      amount: this.ethers.formatEther(result.amount)
    };
  }

  /**
   * Get pending payout amount for player
   */
  async getPendingPayout(address) {
    const contract = this.getContract();
    const payout = await contract.getPendingPayout(address);
    return this.ethers.formatEther(payout);
  }

  /**
   * Get cooldown remaining for player
   */
  async getCooldownRemaining(address) {
    const contract = this.getContract();
    const remaining = await contract.getCooldownRemaining(address);
    return Number(remaining);
  }

  /**
   * Get current sponsor information
   */
  async getCurrentSponsor() {
    const contract = this.getContract();
    const sponsor = await contract.getCurrentSponsor();
    
    return {
      sponsor: sponsor.sponsor,
      name: sponsor.name,
      logoUrl: sponsor.logoUrl,
      timestamp: new Date(Number(sponsor.timestamp) * 1000).toISOString(),
      active: sponsor.active
    };
  }

  /**
   * Get recent winners
   */
  async getRecentWinners() {
    const contract = this.getContract();
    const winners = await contract.getRecentWinners();
    
    return winners.map(winner => ({
      winner: winner.winner,
      amount: this.ethers.formatEther(winner.amount),
      timestamp: new Date(Number(winner.timestamp) * 1000).toISOString(),
      blockNumber: Number(winner.blockNumber)
    }));
  }

  /**
   * Get shot cost
   */
  async getShotCost() {
    const contract = this.getContract();
    const cost = await contract.SHOT_COST();
    return this.ethers.formatEther(cost);
  }

  /**
   * Get sponsor cost
   */
  async getSponsorCost() {
    const contract = this.getContract();
    const cost = await contract.SPONSOR_COST();
    return this.ethers.formatEther(cost);
  }

  /**
   * Get contract balance
   */
  async getContractBalance() {
    const contract = this.getContract();
    const balance = await contract.getContractBalance();
    return this.ethers.formatEther(balance);
  }

  /**
   * Get house funds
   */
  async getHouseFunds() {
    const contract = this.getContract();
    const funds = await contract.getHouseFunds();
    return this.ethers.formatEther(funds);
  }

  /**
   * Override formatters to use ethers.js
   */
  parseAmount(amount) {
    return this.ethers.parseEther(amount.toString());
  }

  formatUnits(amount) {
    return this.ethers.formatEther(amount);
  }

  /**
   * Setup event listeners for Ethereum wallet events
   */
  setupEventListeners(walletInstance, onAccountsChanged, onChainChanged, onDisconnect) {
    if (!walletInstance) return;

    // Ethereum-specific event handling
    if (walletInstance.on) {
      walletInstance.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
          await this.disconnect();
          onDisconnect();
        } else {
          onAccountsChanged(accounts);
        }
      });

      walletInstance.on('chainChanged', (chainId) => {
        onChainChanged(parseInt(chainId, 16));
      });

      walletInstance.on('disconnect', async () => {
        await this.disconnect();
        onDisconnect();
      });
    }
  }
}