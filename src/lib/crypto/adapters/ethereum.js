// Ethereum cryptocurrency adapter
// Implements the BaseCryptoAdapter interface for Ethereum-based interactions

import { BaseCryptoAdapter } from './base.js';
import { WALLET_PROVIDERS } from '../config.js';
import { defaultProviderManager, setupProvidersFromEnv } from '../rpc-provider-manager.js';
import { WALLET_CONFIG } from '../../config.js';
import { safeBigIntToNumber } from '../../stores/game/utils.js';

/**
 * Ethereum adapter for handling ETH transactions and wallet interactions
 */
export class EthereumAdapter extends BaseCryptoAdapter {
  constructor(config) {
    super(config);
    this.ethers = null;
    this.contract = null;
    this.walletInstance = null;
    this.providerManager = defaultProviderManager;
    this.isProviderManagerSetup = false;
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

      // Setup provider manager with fallback providers
      if (!this.isProviderManagerSetup) {
        await setupProvidersFromEnv(this.providerManager, this.ethers);
        this.isProviderManagerSetup = true;
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
        
        const projectId = WALLET_CONFIG.WALLETCONNECT_PROJECT_ID;
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
              commitBlock: safeBigIntToNumber(commitBlock)
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
   * Make a rate-limited contract call
   * @param {string} method - Contract method name
   * @param {Array} params - Method parameters
   * @returns {Promise<*>} Contract call result
   */
  async makeContractCall(method, params = []) {
    const contractAddress = this.config.contractConfig.address;
    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    // Encode the contract call
    const contract = this.getContract();
    const data = contract.interface.encodeFunctionData(method, params);
    
    // Make rate-limited call
    const result = await this.providerManager.makeRequest('eth_call', [
      {
        to: contractAddress,
        data: data
      },
      'latest'
    ]);

    // Decode the result
    return contract.interface.decodeFunctionResult(method, result);
  }

  /**
   * Batch multiple contract calls for efficiency
   * @param {Array} calls - Array of {method, params} objects
   * @returns {Promise<Array>} Array of decoded results
   */
  async batchContractCalls(calls) {
    const contractAddress = this.config.contractConfig.address;
    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    const contract = this.getContract();
    
    // Prepare batch requests
    const requests = calls.map(call => {
      const data = contract.interface.encodeFunctionData(call.method, call.params || []);
      return {
        method: 'eth_call',
        params: [
          {
            to: contractAddress,
            data: data
          },
          'latest'
        ]
      };
    });

    // Execute batch request
    const results = await this.providerManager.batchRequests(requests);
    
    // Decode results
    return results.map((result, index) => {
      if (result instanceof Error) {
        throw result;
      }
      return contract.interface.decodeFunctionResult(calls[index].method, result);
    });
  }

  /**
   * Get current pot size
   */
  async getCurrentPot() {
    try {
      const [pot] = await this.makeContractCall('getCurrentPot');
      return this.ethers.formatEther(pot);
    } catch (error) {
      console.warn('Failed to fetch current pot, using cached value:', error.message);
      return '0'; // Fallback value
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(address) {
    try {
      const [stats] = await this.makeContractCall('getPlayerStats', [address]);
      
      return {
        totalShots: safeBigIntToNumber(stats.totalShots),
        totalSpent: this.ethers.formatEther(stats.totalSpent),
        totalWon: this.ethers.formatEther(stats.totalWon),
        lastShotTime: new Date(safeBigIntToNumber(stats.lastShotTime) * 1000).toISOString()
      };
    } catch (error) {
      console.warn('Failed to fetch player stats:', error.message);
      return {
        totalShots: 0,
        totalSpent: '0',
        totalWon: '0',
        lastShotTime: new Date().toISOString()
      };
    }
  }

  /**
   * Check if player can commit a shot
   */
  async canTakeShot(address) {
    try {
      const [canCommit] = await this.makeContractCall('canCommitShot', [address]);
      return canCommit;
    } catch (error) {
      console.warn('Failed to check if player can take shot:', error.message);
      return false;
    }
  }

  /**
   * Check if player can reveal their shot
   */
  async canRevealShot(address) {
    try {
      const [canReveal] = await this.makeContractCall('canRevealShot', [address]);
      return canReveal;
    } catch (error) {
      console.warn('Failed to check if player can reveal shot:', error.message);
      return false;
    }
  }

  /**
   * Check if player has a pending shot
   */
  async hasPendingShot(address) {
    try {
      const [hasPending] = await this.makeContractCall('hasPendingShot', [address]);
      return hasPending;
    } catch (error) {
      console.warn('Failed to check pending shot:', error.message);
      return false;
    }
  }

  /**
   * Get pending shot details for player
   */
  async getPendingShot(address) {
    try {
      const result = await this.makeContractCall('getPendingShot', [address]);
      
      return {
        exists: result.exists,
        blockNumber: safeBigIntToNumber(result.blockNumber),
        amount: this.ethers.formatEther(result.amount)
      };
    } catch (error) {
      console.warn('Failed to fetch pending shot details:', error.message);
      return {
        exists: false,
        blockNumber: 0,
        amount: '0'
      };
    }
  }

  /**
   * Get pending payout amount for player
   */
  async getPendingPayout(address) {
    try {
      const [payout] = await this.makeContractCall('getPendingPayout', [address]);
      return this.ethers.formatEther(payout);
    } catch (error) {
      console.warn('Failed to fetch pending payout:', error.message);
      return '0';
    }
  }

  /**
   * Get cooldown remaining for player
   */
  async getCooldownRemaining(address) {
    try {
      const [remaining] = await this.makeContractCall('getCooldownRemaining', [address]);
      return safeBigIntToNumber(remaining);
    } catch (error) {
      console.warn('Failed to fetch cooldown remaining:', error.message);
      return 0;
    }
  }

  /**
   * Get current sponsor information
   */
  async getCurrentSponsor() {
    try {
      const sponsor = await this.makeContractCall('getCurrentSponsor');
      
      return {
        sponsor: sponsor.sponsor,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        timestamp: new Date(safeBigIntToNumber(sponsor.timestamp) * 1000).toISOString(),
        active: sponsor.active
      };
    } catch (error) {
      console.warn('Failed to fetch current sponsor:', error.message);
      return {
        sponsor: '0x0000000000000000000000000000000000000000',
        name: '',
        logoUrl: '',
        timestamp: new Date().toISOString(),
        active: false
      };
    }
  }

  /**
   * Get recent winners
   */
  async getRecentWinners() {
    try {
      const [winners] = await this.makeContractCall('getRecentWinners');
      
      return winners.map(winner => ({
        winner: winner.winner,
        amount: this.ethers.formatEther(winner.amount),
        timestamp: new Date(safeBigIntToNumber(winner.timestamp) * 1000).toISOString(),
        blockNumber: safeBigIntToNumber(winner.blockNumber)
      }));
    } catch (error) {
      console.warn('Failed to fetch recent winners:', error.message);
      return [];
    }
  }

  /**
   * Get multiple contract values efficiently using batch calls
   */
  async getGameData() {
    try {
      const calls = [
        { method: 'getCurrentPot' },
        { method: 'SHOT_COST' },
        { method: 'SPONSOR_COST' },
        { method: 'getContractBalance' },
        { method: 'getHouseFunds' },
        { method: 'getRecentWinners' },
        { method: 'getCurrentSponsor' }
      ];

      const results = await this.batchContractCalls(calls);
      
      return {
        currentPot: this.ethers.formatEther(results[0][0]),
        shotCost: this.ethers.formatEther(results[1][0]),
        sponsorCost: this.ethers.formatEther(results[2][0]),
        contractBalance: this.ethers.formatEther(results[3][0]),
        houseFunds: this.ethers.formatEther(results[4][0]),
        recentWinners: results[5][0].map(winner => ({
          winner: winner.winner,
          amount: this.ethers.formatEther(winner.amount),
          timestamp: new Date(safeBigIntToNumber(winner.timestamp) * 1000).toISOString(),
          blockNumber: safeBigIntToNumber(winner.blockNumber)
        })),
        currentSponsor: {
          sponsor: results[6].sponsor,
          name: results[6].name,
          logoUrl: results[6].logoUrl,
          timestamp: new Date(safeBigIntToNumber(results[6].timestamp) * 1000).toISOString(),
          active: results[6].active
        }
      };
    } catch (error) {
      console.warn('Failed to fetch game data batch, falling back to individual calls:', error.message);
      
      // Fallback to individual calls
      const [currentPot, shotCost, sponsorCost, contractBalance, houseFunds, recentWinners, currentSponsor] = await Promise.allSettled([
        this.getCurrentPot(),
        this.getShotCost(),
        this.getSponsorCost(),
        this.getContractBalance(),
        this.getHouseFunds(),
        this.getRecentWinners(),
        this.getCurrentSponsor()
      ]);

      return {
        currentPot: currentPot.status === 'fulfilled' ? currentPot.value : '0',
        shotCost: shotCost.status === 'fulfilled' ? shotCost.value : '0.0005',
        sponsorCost: sponsorCost.status === 'fulfilled' ? sponsorCost.value : '0.001',
        contractBalance: contractBalance.status === 'fulfilled' ? contractBalance.value : '0',
        houseFunds: houseFunds.status === 'fulfilled' ? houseFunds.value : '0',
        recentWinners: recentWinners.status === 'fulfilled' ? recentWinners.value : [],
        currentSponsor: currentSponsor.status === 'fulfilled' ? currentSponsor.value : {
          sponsor: '0x0000000000000000000000000000000000000000',
          name: '',
          logoUrl: '',
          timestamp: new Date().toISOString(),
          active: false
        }
      };
    }
  }

  /**
   * Get shot cost
   */
  async getShotCost() {
    try {
      const [cost] = await this.makeContractCall('SHOT_COST');
      return this.ethers.formatEther(cost);
    } catch (error) {
      console.warn('Failed to fetch shot cost:', error.message);
      return '0.0005'; // Fallback value
    }
  }

  /**
   * Get sponsor cost
   */
  async getSponsorCost() {
    try {
      const [cost] = await this.makeContractCall('SPONSOR_COST');
      return this.ethers.formatEther(cost);
    } catch (error) {
      console.warn('Failed to fetch sponsor cost:', error.message);
      return '0.001'; // Fallback value
    }
  }

  /**
   * Get contract balance
   */
  async getContractBalance() {
    try {
      const [balance] = await this.makeContractCall('getContractBalance');
      return this.ethers.formatEther(balance);
    } catch (error) {
      console.warn('Failed to fetch contract balance:', error.message);
      return '0';
    }
  }

  /**
   * Get house funds
   */
  async getHouseFunds() {
    try {
      const [funds] = await this.makeContractCall('getHouseFunds');
      return this.ethers.formatEther(funds);
    } catch (error) {
      console.warn('Failed to fetch house funds:', error.message);
      return '0';
    }
  }

  /**
   * Get game configuration in basis points
   */
  async getGameConfig() {
    const contract = this.getContract();
    const config = await contract.getGameConfig();
    
    return {
              winPercentageBP: safeBigIntToNumber(config.winPercentageBP),
        housePercentageBP: safeBigIntToNumber(config.housePercentageBP),
        winChanceBP: safeBigIntToNumber(config.winChanceBP)
    };
  }

  /**
   * Get cooldown period from contract
   */
  async getCooldownPeriod() {
    const contract = this.getContract();
    const period = await contract.COOLDOWN_PERIOD();
    return safeBigIntToNumber(period);
  }

  /**
   * Get win percentage in basis points
   */
  async getWinPercentageBP() {
    const contract = this.getContract();
    const percentage = await contract.WIN_PERCENTAGE_BP();
    return safeBigIntToNumber(percentage);
  }

  /**
   * Get house percentage in basis points
   */
  async getHousePercentageBP() {
    const contract = this.getContract();
    const percentage = await contract.HOUSE_PERCENTAGE_BP();
    return safeBigIntToNumber(percentage);
  }

  /**
   * Get win chance in basis points
   */
  async getWinChanceBP() {
    const contract = this.getContract();
    const chance = await contract.WIN_CHANCE_BP();
    return safeBigIntToNumber(chance);
  }

  /**
   * Get maximum recent winners limit
   */
  async getMaxRecentWinners() {
    const contract = this.getContract();
    const max = await contract.MAX_RECENT_WINNERS();
    return safeBigIntToNumber(max);
  }

  /**
   * Get minimum pot size
   */
  async getMinPotSize() {
    const contract = this.getContract();
    const minSize = await contract.MIN_POT_SIZE();
    return this.ethers.formatEther(minSize);
  }

  /**
   * Withdraw house funds (owner only)
   */
  async withdrawHouseFunds() {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Check if user has house funds to withdraw
    const houseFunds = await contract.getHouseFunds();
    if (houseFunds === 0n) {
      throw new Error('No house funds to withdraw');
    }

    // Send withdrawHouseFunds transaction
    const tx = await contractWithSigner.withdrawHouseFunds();

    console.log('✅ House funds withdrawal transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    
    const withdrawnAmount = this.ethers.formatEther(houseFunds);

    return {
      hash: tx.hash,
      receipt,
      withdrawnAmount
    };
  }

  /**
   * Pause the contract (owner only)
   */
  async pauseContract() {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Send pause transaction
    const tx = await contractWithSigner.pause();

    console.log('✅ Contract pause transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt
    };
  }

  /**
   * Unpause the contract (owner only)
   */
  async unpauseContract() {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Send unpause transaction
    const tx = await contractWithSigner.unpause();

    console.log('✅ Contract unpause transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt
    };
  }

  /**
   * Set test mode (owner only)
   */
  async setTestMode(enabled) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Send setTestMode transaction
    const tx = await contractWithSigner.setTestMode(enabled);

    console.log('✅ Set test mode transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt,
      testMode: enabled
    };
  }

  /**
   * Set winning number for test mode (owner only)
   */
  async setWinningNumber(winningNumber) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const contract = this.getContract();
    const contractWithSigner = contract.connect(this.signer);
    
    // Send setWinningNumber transaction
    const tx = await contractWithSigner.setWinningNumber(winningNumber);

    console.log('✅ Set winning number transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      hash: tx.hash,
      receipt,
      winningNumber
    };
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