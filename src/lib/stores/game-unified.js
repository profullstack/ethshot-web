/**
 * Unified Multi-Cryptocurrency Game Store
 * 
 * Consolidates game.js and game-multi-crypto.js into a single, comprehensive store
 * that supports multiple cryptocurrencies while maintaining all advanced features
 * from the original ETH-specific implementation.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { multiCryptoWalletStore } from './wallet-multi-crypto.js';
import { walletStore } from './wallet.js';
import { toastStore } from './toast.js';
import { db, formatAddress, formatEther, formatTimeAgo } from '../supabase.js';
import { getActiveAdapter } from '../crypto/adapters/index.js';
import { getCryptoGameConfig, getCurrentCrypto } from '../crypto/config.js';
import { GAME_CONFIG, NETWORK_CONFIG, SOCIAL_CONFIG, UI_CONFIG, calculateUSDValue } from '../config.js';
import { shareOnTwitter as shareOnTwitterExternal } from '../utils/external-links.js';
import {
  notificationManager,
  notifyJackpotWon,
  notifyShotTaken,
  notifyPotMilestone,
  scheduleCooldownNotification
} from '../utils/notifications.js';

// Winner event store for triggering animations
export const winnerEventStore = writable(null);

// ETH Shot contract ABI (for backward compatibility with ETH-only mode)
const ETH_SHOT_ABI = [
  'function takeShot() external payable',
  'function sponsorRound(string calldata name, string calldata logoUrl) external payable',
  'function getCurrentPot() external view returns (uint256)',
  'function getContractBalance() external view returns (uint256)',
  'function getHouseFunds() external view returns (uint256)',
  'function getPlayerStats(address player) external view returns (tuple(uint256 totalShots, uint256 totalSpent, uint256 totalWon, uint256 lastShotTime))',
  'function canTakeShot(address player) external view returns (bool)',
  'function getCooldownRemaining(address player) external view returns (uint256)',
  'function getCurrentSponsor() external view returns (tuple(address sponsor, string name, string logoUrl, uint256 timestamp, bool active))',
  'function getRecentWinners() external view returns (tuple(address winner, uint256 amount, uint256 timestamp, uint256 blockNumber)[])',
  'function SHOT_COST() external view returns (uint256)',
  'function SPONSOR_COST() external view returns (uint256)',
  'event ShotTaken(address indexed player, uint256 amount, bool won)',
  'event JackpotWon(address indexed winner, uint256 amount, uint256 timestamp)',
  'event SponsorshipActivated(address indexed sponsor, string name, string logoUrl)',
];

// Cache for reducing RPC calls
const rpcCache = {
  data: new Map(),
  timestamps: new Map(),
  TTL: 30000, // 30 seconds cache
  
  get(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp < this.TTL) {
      return this.data.get(key);
    }
    return null;
  },
  
  set(key, value) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
  },
  
  invalidate(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        this.data.delete(key);
        this.timestamps.delete(key);
      });
    } else {
      this.data.delete(keys);
      this.timestamps.delete(keys);
    }
  }
};

// Unified game state store
const createUnifiedGameStore = () => {
  const { subscribe, set, update } = writable({
    // Contract/Program info
    contractAddress: '',
    contract: null,
    contractDeployed: null, // null = unknown, true = deployed, false = not deployed

    // Game state
    currentPot: '0',
    currentPotUSD: '0', // USD value of current pot
    shotCost: '0',
    shotCostUSD: '0', // USD value of shot cost
    sponsorCost: '0',
    sponsorCostUSD: '0', // USD value of sponsor cost
    
    // Player state
    playerStats: null,
    canShoot: false,
    cooldownRemaining: 0,
    
    // Sponsor info
    currentSponsor: null,
    
    // Leaderboard and winners
    recentWinners: [],
    topPlayers: [],
    
    // UI state
    loading: false,
    takingShot: false,
    error: null,
    
    // Multi-crypto state
    activeCrypto: 'ETH', // Default to ETH for backward compatibility
    gameConfig: null,
    isMultiCryptoMode: false, // Flag to determine which wallet store to use
    
    // Real-time updates
    lastUpdate: null,
  });

  let contract = null;
  let updateInterval = null;
  let ethers = null;

  // Helper function to get the appropriate wallet store
  const getWalletStore = () => {
    const state = get({ subscribe });
    return state.isMultiCryptoMode ? multiCryptoWalletStore : walletStore;
  };

  // Helper function to create provider with retry logic (ETH-only mode)
  const createProviderWithRetry = async () => {
    return await retryWithBackoff(async () => {
      const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.RPC_URL);
      // Test the provider with a simple call
      await provider.getNetwork();
      console.log(`Successfully connected to RPC: ${NETWORK_CONFIG.RPC_URL}`);
      return provider;
    }, 3, 2000);
  };

  // Helper function to retry operations with exponential backoff
  const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Don't retry on certain errors
        if (error.message.includes('Too Many Requests') && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  };

  // Helper function to update USD values
  const updateUSDValues = async (state) => {
    try {
      const [potUSD, shotUSD, sponsorUSD] = await Promise.all([
        calculateUSDValue(state.currentPot),
        calculateUSDValue(state.shotCost),
        calculateUSDValue(state.sponsorCost)
      ]);

      return {
        ...state,
        currentPotUSD: potUSD,
        shotCostUSD: shotUSD,
        sponsorCostUSD: sponsorUSD
      };
    } catch (error) {
      console.warn('Failed to update USD values:', error);
      return state;
    }
  };

  // Initialize game store
  const init = async (cryptoType = null, multiCryptoMode = false) => {
    if (!browser) {
      console.warn('Unified game initialization skipped on server');
      return;
    }

    try {
      const targetCrypto = cryptoType || (multiCryptoMode ? getCurrentCrypto().type : 'ETH');
      const gameConfig = multiCryptoMode ? getCryptoGameConfig(targetCrypto) : GAME_CONFIG;

      update(state => ({
        ...state,
        activeCrypto: targetCrypto,
        gameConfig,
        isMultiCryptoMode: multiCryptoMode,
        loading: true,
        error: null
      }));

      if (multiCryptoMode) {
        // Multi-crypto mode: use adapter pattern
        const adapter = getActiveAdapter();
        if (!adapter) {
          throw new Error(`No adapter found for ${targetCrypto}. Please initialize wallet first.`);
        }

        // Check if contract/program is deployed
        try {
          await adapter.getShotCost(); // Test call to verify deployment
          
          update(state => ({
            ...state,
            contractDeployed: true,
            contractAddress: adapter.config.contractConfig.address || 'N/A'
          }));
          
        } catch (contractError) {
          console.error('Contract/Program not deployed or not accessible:', contractError);
          
          let errorMessage = `${targetCrypto} contract not found at the configured address.`;
          if (contractError.message.includes('not yet implemented')) {
            errorMessage = contractError.message;
          } else if (contractError.message.includes('Too Many Requests')) {
            errorMessage = 'RPC provider rate limit exceeded. Please try again later.';
          }
          
          update(state => ({
            ...state,
            contractDeployed: false,
            loading: false,
            error: errorMessage
          }));
          return;
        }
      } else {
        // ETH-only mode: direct ethers.js integration
        const contractAddress = NETWORK_CONFIG.CONTRACT_ADDRESS;
        if (!contractAddress || contractAddress === '0x1234567890123456789012345678901234567890') {
          console.warn('Contract address not configured or using placeholder');
          update(state => ({
            ...state,
            contractAddress: contractAddress || 'Not configured',
            contractDeployed: false,
            loading: false,
            error: 'Smart contract not deployed yet. Please deploy the contract first.'
          }));
          return;
        }

        update(state => ({
          ...state,
          contractAddress,
        }));

        // Dynamic import for browser-only ethers library
        const ethersModule = await import('ethers');
        ethers = ethersModule;

        // Create contract instance with read-only provider and retry logic
        const provider = await createProviderWithRetry();
        contract = new ethers.Contract(contractAddress, ETH_SHOT_ABI, provider);
        
        // Check if contract is actually deployed by trying to call a view function
        try {
          await retryWithBackoff(() => contract.SHOT_COST(), 3, 1000);
          
          update(state => ({
            ...state,
            contractDeployed: true,
            contract
          }));
          
        } catch (contractError) {
          console.error('Contract not deployed or not accessible:', contractError);
          
          let errorMessage = 'Smart contract not found at the configured address.';
          if (contractError.message.includes('Too Many Requests')) {
            errorMessage = 'RPC provider rate limit exceeded. Please try again later or use a different RPC endpoint.';
          } else if (contractError.message.includes('missing response')) {
            errorMessage = 'Unable to connect to blockchain network. Please check your internet connection.';
          }
          
          update(state => ({
            ...state,
            contractDeployed: false,
            loading: false,
            error: errorMessage
          }));
          return;
        }
      }
      
      // Load initial game state
      await loadGameState();
      
      // Start real-time updates
      startRealTimeUpdates();
      
      update(async state => {
        const updatedState = await updateUSDValues({
          ...state,
          loading: false,
          lastUpdate: new Date().toISOString()
        });
        return updatedState;
      });
      
    } catch (error) {
      console.error('Failed to initialize unified game:', error);
      
      let errorMessage = `Failed to initialize ${cryptoType || 'game'}: ${error.message}`;
      if (error.message.includes('Too Many Requests')) {
        errorMessage = 'RPC provider rate limit exceeded. Please try again later.';
      }
      
      update(state => ({
        ...state,
        contractDeployed: false,
        loading: false,
        error: errorMessage
      }));
    }
  };

  // Switch to a different cryptocurrency (multi-crypto mode only)
  const switchCrypto = async (cryptoType) => {
    if (!browser) return;

    const state = get({ subscribe });
    if (!state.isMultiCryptoMode) {
      console.warn('switchCrypto called in single-crypto mode');
      return;
    }

    try {
      update(state => ({
        ...state,
        loading: true,
        error: null
      }));

      // Stop current real-time updates
      stopRealTimeUpdates();

      // Clear cache
      rpcCache.clear();

      // Initialize for new crypto
      await init(cryptoType, true);

    } catch (error) {
      console.error(`Failed to switch game to ${cryptoType}:`, error);
      
      update(state => ({
        ...state,
        loading: false,
        error: `Failed to switch to ${cryptoType}: ${error.message}`
      }));
    }
  };

  // Load game state from contract/program and database
  const loadGameState = async () => {
    if (!browser) return;

    const state = get({ subscribe });

    try {
      let contractBalance, houseFunds, shotCost, sponsorCost, currentSponsor, recentWinners;

      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter
        const adapter = getActiveAdapter();
        if (!adapter) {
          console.warn('No active adapter for loading game state');
          return;
        }

        // Check cache first
        contractBalance = rpcCache.get('contractBalance');
        houseFunds = rpcCache.get('houseFunds');
        shotCost = rpcCache.get('shotCost');
        sponsorCost = rpcCache.get('sponsorCost');
        currentSponsor = rpcCache.get('currentSponsor');
        recentWinners = rpcCache.get('recentWinners');

        // Only fetch from contract if not cached
        const contractCalls = [];
        if (!contractBalance) contractCalls.push(['contractBalance', () => adapter.getContractBalance()]);
        if (!houseFunds) contractCalls.push(['houseFunds', () => adapter.getHouseFunds()]);
        if (!shotCost) contractCalls.push(['shotCost', () => adapter.getShotCost()]);
        if (!sponsorCost) contractCalls.push(['sponsorCost', () => adapter.getSponsorCost()]);
        if (!currentSponsor) contractCalls.push(['currentSponsor', () => adapter.getCurrentSponsor()]);
        if (!recentWinners) contractCalls.push(['recentWinners', () => adapter.getRecentWinners()]);

        // Execute calls sequentially
        for (const [key, call] of contractCalls) {
          try {
            const result = await retryWithBackoff(call, 2, 2000);
            rpcCache.set(key, result);
            
            if (key === 'contractBalance') contractBalance = result;
            else if (key === 'houseFunds') houseFunds = result;
            else if (key === 'shotCost') shotCost = result;
            else if (key === 'sponsorCost') sponsorCost = result;
            else if (key === 'currentSponsor') currentSponsor = result;
            else if (key === 'recentWinners') recentWinners = result;
            
            // Add delay between calls
            if (contractCalls.indexOf([key, call]) < contractCalls.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.warn(`Failed to fetch ${key}, using cached or default value:`, error.message);
            // Use defaults for failed calls
            if (key === 'contractBalance') contractBalance = contractBalance || '0';
            else if (key === 'houseFunds') houseFunds = houseFunds || '0';
            else if (key === 'shotCost') shotCost = shotCost || '0';
            else if (key === 'sponsorCost') sponsorCost = sponsorCost || '0';
            else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
            else if (key === 'recentWinners') recentWinners = recentWinners || [];
          }
        }

        // Calculate actual pot using adapter
        const actualPot = await adapter.getCurrentPot();
        
        update(async state => {
          const updatedState = await updateUSDValues({
            ...state,
            currentPot: actualPot || '0',
            shotCost: shotCost || '0',
            sponsorCost: sponsorCost || '0',
          });
          return updatedState;
        });

      } else {
        // ETH-only mode: direct contract calls
        if (!contract || !ethers) return;

        // Check cache first
        contractBalance = rpcCache.get('contractBalance');
        houseFunds = rpcCache.get('houseFunds');
        shotCost = rpcCache.get('shotCost');
        sponsorCost = rpcCache.get('sponsorCost');
        currentSponsor = rpcCache.get('currentSponsor');
        recentWinners = rpcCache.get('recentWinners');

        // Only fetch from contract if not cached
        const contractCalls = [];
        if (!contractBalance) contractCalls.push(['contractBalance', () => contract.getContractBalance()]);
        if (!houseFunds) contractCalls.push(['houseFunds', () => contract.getHouseFunds()]);
        if (!shotCost) contractCalls.push(['shotCost', () => contract.SHOT_COST()]);
        if (!sponsorCost) contractCalls.push(['sponsorCost', () => contract.SPONSOR_COST()]);
        if (!currentSponsor) contractCalls.push(['currentSponsor', () => contract.getCurrentSponsor()]);
        if (!recentWinners) contractCalls.push(['recentWinners', () => contract.getRecentWinners()]);

        // Execute calls sequentially
        for (const [key, call] of contractCalls) {
          try {
            const result = await retryWithBackoff(call, 2, 2000);
            rpcCache.set(key, result);
            
            if (key === 'contractBalance') contractBalance = result;
            else if (key === 'houseFunds') houseFunds = result;
            else if (key === 'shotCost') shotCost = result;
            else if (key === 'sponsorCost') sponsorCost = result;
            else if (key === 'currentSponsor') currentSponsor = result;
            else if (key === 'recentWinners') recentWinners = result;
            
            // Add delay between calls
            if (contractCalls.indexOf([key, call]) < contractCalls.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.warn(`Failed to fetch ${key}, using cached or default value:`, error.message);
            // Use defaults for failed calls
            if (key === 'contractBalance') contractBalance = contractBalance || '0';
            else if (key === 'houseFunds') houseFunds = houseFunds || '0';
            else if (key === 'shotCost') shotCost = shotCost || ethers.parseEther('0.001');
            else if (key === 'sponsorCost') sponsorCost = sponsorCost || ethers.parseEther('0.001');
            else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
            else if (key === 'recentWinners') recentWinners = recentWinners || [];
          }
        }

        // Calculate actual pot (contract balance minus house funds)
        const actualPot = contractBalance && houseFunds ?
          BigInt(contractBalance) - BigInt(houseFunds) :
          BigInt(contractBalance || '0');
          
        // Force fresh contract calls if pot seems wrong
        if (ethers.formatEther(actualPot) === '0.001') {
          console.log('🚨 Pot is 0.001 ETH - forcing fresh contract calls to verify');
          try {
            const freshContractBalance = await contract.getContractBalance();
            const freshHouseFunds = await contract.getHouseFunds();
            
            // Use fresh data if different
            if (freshContractBalance.toString() !== contractBalance?.toString() ||
                freshHouseFunds.toString() !== houseFunds?.toString()) {
              console.log('📊 Using fresh data instead of cached data');
              contractBalance = freshContractBalance;
              houseFunds = freshHouseFunds;
              
              // Update cache with fresh data
              rpcCache.set('contractBalance', contractBalance);
              rpcCache.set('houseFunds', houseFunds);
            }
          } catch (freshError) {
            console.error('❌ Failed to fetch fresh contract data:', freshError);
          }
        }

        const newPotAmount = ethers.formatEther(actualPot);
        const previousPot = get({ subscribe }).currentPot;
        
        // Check for pot milestones (1 ETH, 5 ETH, 10 ETH, etc.)
        if (previousPot && newPotAmount !== previousPot) {
          const prevValue = parseFloat(previousPot);
          const newValue = parseFloat(newPotAmount);
          
          // Check if we crossed a milestone
          const milestones = [1, 5, 10, 25, 50, 100];
          for (const milestone of milestones) {
            if (prevValue < milestone && newValue >= milestone) {
              notifyPotMilestone(`${milestone} ETH`);
              console.log(`🚀 Pot milestone reached: ${milestone} ETH`);
              break;
            }
          }
        }

        update(async state => {
          const updatedState = await updateUSDValues({
            ...state,
            currentPot: newPotAmount,
            shotCost: ethers.formatEther(shotCost || ethers.parseEther('0.001')),
            sponsorCost: ethers.formatEther(sponsorCost || ethers.parseEther('0.001')),
          });
          return updatedState;
        });
      }

      // Load database data (common for both modes)
      const [dbWinners, dbStats, dbSponsors, topPlayers] = await Promise.all([
        db.getRecentWinners(10),
        db.getGameStats(),
        db.getCurrentSponsor(),
        db.getTopPlayers(10)
      ]);

      // Use database data when available, fallback to contract data
      const winners = dbWinners.length > 0 ? dbWinners : (recentWinners || []).map(winner => ({
        ...winner,
        amount: state.isMultiCryptoMode ? winner.amount : ethers.formatEther(winner.amount),
        timestamp: new Date(Number(winner.timestamp) * 1000).toISOString()
      }));

      const sponsor = dbSponsors || (currentSponsor?.active ? currentSponsor : null);

      update(state => ({
        ...state,
        currentSponsor: sponsor,
        recentWinners: winners,
        topPlayers: topPlayers || [],
        lastUpdate: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Failed to load game state:', error);
      update(state => ({ ...state, error: error.message }));
    }
  };

  // Load player-specific data
  const loadPlayerData = async (address) => {
    if (!browser || !address) return;

    const state = get({ subscribe });

    try {
      let playerStats, canShoot, cooldownRemaining;

      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter
        const adapter = getActiveAdapter();
        if (!adapter) return;

        [playerStats, canShoot, cooldownRemaining] = await Promise.all([
          adapter.getPlayerStats(address),
          adapter.canTakeShot(address),
          adapter.getCooldownRemaining(address)
        ]);
      } else {
        // ETH-only mode: direct contract calls
        if (!contract) return;

        [playerStats, canShoot, cooldownRemaining] = await Promise.all([
          contract.getPlayerStats(address),
          contract.canTakeShot(address),
          contract.getCooldownRemaining(address)
        ]);

        // Format ETH-specific data
        playerStats = {
          totalShots: Number(playerStats.totalShots),
          totalSpent: ethers.formatEther(playerStats.totalSpent),
          totalWon: ethers.formatEther(playerStats.totalWon),
          lastShotTime: new Date(Number(playerStats.lastShotTime) * 1000).toISOString(),
        };

        cooldownRemaining = Number(cooldownRemaining);
      }

      // Also load player data from database for additional stats
      const dbPlayerStats = await db.getPlayer(address);

      // Schedule cooldown notification if player has cooldown
      if (cooldownRemaining > 0) {
        scheduleCooldownNotification(cooldownRemaining);
        console.log(`🔔 Scheduled cooldown notification for ${cooldownRemaining} seconds`);
      }

      update(state => ({
        ...state,
        playerStats: {
          ...playerStats,
          // Additional stats from database
          ...dbPlayerStats
        },
        canShoot,
        cooldownRemaining,
        lastUpdate: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Failed to load player data:', error);
    }
  };

  // Take a shot at the jackpot
  const takeShot = async () => {
    console.log('🎯 Unified gameStore.takeShot() called!');
    
    if (!browser) {
      console.log('❌ Not in browser environment');
      toastStore.error('Not available on server');
      return;
    }

    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    console.log('👛 Wallet state:', {
      connected: wallet.connected,
      address: wallet.address,
      activeCrypto: wallet.activeCrypto || 'ETH'
    });
    
    if (!wallet.connected || !wallet.address) {
      console.log('❌ Wallet not connected');
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (state.contractDeployed === false) {
      console.log('❌ Contract not deployed');
      toastStore.error(`${state.activeCrypto} contract not deployed yet.`);
      return;
    }

    console.log('✅ All takeShot checks passed, starting transaction...');

    try {
      update(state => ({ ...state, takingShot: true, error: null }));

      let result;

      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter
        const adapter = getActiveAdapter();
        if (!adapter) {
          throw new Error('No active cryptocurrency adapter');
        }

        result = await adapter.takeShot();
      } else {
        // ETH-only mode: direct contract interaction
        if (!contract || !ethers || !wallet.signer) {
          throw new Error('Contract or signer not available');
        }

        const contractWithSigner = contract.connect(wallet.signer);
        const shotCost = await contract.SHOT_COST();

        // Check user balance
        const balance = await wallet.provider.getBalance(wallet.address);
        
        // Estimate gas
        let gasEstimate;
        try {
          gasEstimate = await contractWithSigner.takeShot.estimateGas({
            value: shotCost
          });
        } catch (estimateError) {
          console.warn('Failed to estimate gas, using default:', estimateError.message);
          gasEstimate = 150000n;
        }
        
        const gasLimit = gasEstimate < 120000n ? 150000n : gasEstimate + (gasEstimate * 20n / 100n);
        
        // Get gas price and calculate total cost
        const feeData = await wallet.provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
        const estimatedGasCost = gasLimit * gasPrice;
        const totalCost = shotCost + estimatedGasCost;
        
        if (balance < totalCost) {
          const shortfall = ethers.formatEther(totalCost - balance);
          throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
        }

        // Send transaction
        const tx = await contractWithSigner.takeShot({
          value: shotCost,
          gasLimit: gasLimit
        });

        toastStore.info('Shot submitted! Waiting for confirmation...');
        const receipt = await tx.wait();
        
        // Check if user won by looking at events
        const shotTakenEvent = receipt.logs.find(log => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed.name === 'ShotTaken';
          } catch {
            return false;
          }
        });

        let won = false;
        if (shotTakenEvent) {
          const parsed = contract.interface.parseLog(shotTakenEvent);
          won = parsed.args.won;
        }

        result = {
          hash: receipt.hash,
          receipt,
          won
        };
      }
      
      console.log('✅ Shot transaction completed:', result.hash);
      
      if (result.won) {
        toastStore.success('🎉 JACKPOT! You won the pot!');
        
        // Trigger winner animation
        winnerEventStore.set({
          winner: wallet.address,
          amount: state.currentPot,
          timestamp: new Date().toISOString()
        });
        
        // Notify all users about the jackpot win
        notifyJackpotWon(state.currentPot, wallet.address);
      } else {
        toastStore.info('Shot taken! Better luck next time.');
      }

      // Log transaction to database
      try {
        console.log('📝 Recording shot to database...');

        const shotRecord = await db.recordShot({
          playerAddress: wallet.address,
          amount: state.shotCost,
          won: result.won,
          txHash: result.hash,
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          cryptoType: state.activeCrypto
        });

        console.log('✅ Shot recorded successfully:', shotRecord?.id);

        if (result.won) {
          console.log('🏆 Recording winner to database...');
          const winnerRecord = await db.recordWinner({
            winnerAddress: wallet.address,
            amount: state.currentPot,
            txHash: result.hash,
            blockNumber: result.receipt.blockNumber,
            timestamp: new Date().toISOString(),
            cryptoType: state.activeCrypto
          });
          console.log('✅ Winner recorded successfully:', winnerRecord?.id);
        }

        // Update player record
        console.log('👤 Updating player record...');
        const existingPlayer = await db.getPlayer(wallet.address);
        
        const newTotalShots = (existingPlayer?.total_shots || 0) + 1;
        const newTotalSpent = parseFloat(existingPlayer?.total_spent || '0') + parseFloat(state.shotCost);
        const newTotalWon = result.won ?
          parseFloat(existingPlayer?.total_won || '0') + parseFloat(state.currentPot) :
          parseFloat(existingPlayer?.total_won || '0');

        const playerData = {
          address: wallet.address,
          totalShots: newTotalShots,
          totalSpent: newTotalSpent.toString(),
          totalWon: newTotalWon.toString(),
          lastShotTime: new Date().toISOString(),
          cryptoType: state.activeCrypto
        };

        const playerRecord = await db.upsertPlayer(playerData);
        console.log('✅ Player record updated successfully:', playerRecord?.address);

      } catch (dbError) {
        console.error('❌ Failed to log transaction to database:', dbError);
        toastStore.error('Shot successful but failed to update leaderboard. Please refresh the page.');
      }

      // Clear cache to force fresh data fetch
      rpcCache.clear();
      
      // Add a small delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh game state with fresh data
      await loadGameState();
      await loadPlayerData(wallet.address);
      
      // Update wallet balance
      await walletStore.updateBalance();

    } catch (error) {
      console.error('Failed to take shot:', error);
      
      let errorMessage = 'Failed to take shot';
      if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient ${state.activeCrypto} balance`;
      } else if (error.message.includes('Cooldown')) {
        errorMessage = 'Please wait for cooldown period';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toastStore.error(errorMessage);
      update(state => ({ ...state, error: errorMessage }));
    } finally {
      update(state => ({ ...state, takingShot: false }));
    }
  };

  // Sponsor a round
  const sponsorRound = async (name, logoUrl, sponsorUrl = null) => {
    if (!browser) {
      toastStore.error('Not available on server');
      return;
    }

    const state = get({ subscribe });
    const walletStore = getWalletStore();
    const wallet = get(walletStore);
    
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    if (state.contractDeployed === false) {
      toastStore.error(`${state.activeCrypto} contract not deployed yet.`);
      return;
    }

    if (!name || !logoUrl) {
      toastStore.error('Please provide sponsor name and logo URL');
      return;
    }

    try {
      let result;

      if (state.isMultiCryptoMode) {
        // Multi-crypto mode: use adapter
        const adapter = getActiveAdapter();
        if (!adapter) {
          throw new Error('No active cryptocurrency adapter');
        }

        result = await adapter.sponsorRound(name, logoUrl);
      } else {
        // ETH-only mode: direct contract interaction
        if (!contract || !ethers || !wallet.signer) {
          throw new Error('Contract or signer not available');
        }

        const contractWithSigner = contract.connect(wallet.signer);
        const sponsorCost = await contract.SPONSOR_COST();

        // Check user balance
        const balance = await wallet.provider.getBalance(wallet.address);
        
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
        
        const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
        
        // Get gas price and calculate total cost
        const feeData = await wallet.provider.getFeeData();
        const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
        const estimatedGasCost = gasLimit * gasPrice;
        const totalCost = sponsorCost + estimatedGasCost;
        
        if (balance < totalCost) {
          const shortfall = ethers.formatEther(totalCost - balance);
          throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
        }

        const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
          value: sponsorCost,
          gasLimit: gasLimit
        });

        toastStore.info('Sponsorship submitted! Waiting for confirmation...');
        const receipt = await tx.wait();
        
        result = {
          hash: receipt.hash,
          receipt
        };
      }
      
      toastStore.success('Round sponsored successfully!');
      
      // Log sponsorship to database
      try {
        await db.recordSponsor({
          sponsorAddress: wallet.address,
          name,
          logoUrl,
          sponsorUrl,
          amount: state.sponsorCost,
          txHash: result.hash,
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          active: true,
          cryptoType: state.activeCrypto
        });
      } catch (dbError) {
        console.error('Failed to log sponsorship to database:', dbError);
      }
      
      // Clear cache and refresh state
      rpcCache.clear();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadGameState();
      await walletStore.updateBalance();

    } catch (error) {
      console.error('Failed to sponsor round:', error);
      
      let errorMessage = 'Failed to sponsor round';
      if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient ${state.activeCrypto} balance`;
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toastStore.error(errorMessage);
    }
  };

  // Share on X (formerly Twitter)
  const shareOnTwitter = () => {
    if (!browser) return;

    const state = get({ subscribe });
    const cryptoSymbol = state.activeCrypto || 'ETH';
    // Ensure we have a valid pot value, fallback to "the current pot" if not loaded
    const potValue = state.currentPot && state.currentPot !== '0' ? `${state.currentPot} ${cryptoSymbol}` : 'the current pot';
    const text = `I just took a shot at #${cryptoSymbol}Shot and the pot is now ${potValue}! 🎯 Try your luck: #${cryptoSymbol.toLowerCase()}`;
    const url = SOCIAL_CONFIG.APP_URL;
    
    console.log('🐦 Sharing on X:', { currentPot: state.currentPot, cryptoSymbol, potValue, text });
    
    // Use the external links utility to properly handle webviews
    shareOnTwitterExternal(text, url);
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!browser) return;

    try {
      await navigator.clipboard.writeText(SOCIAL_CONFIG.APP_URL);
      toastStore.success('Link copied to clipboard!');
    } catch (error) {
      toastStore.error('Failed to copy link');
    }
  };

  // Start real-time updates
  const startRealTimeUpdates = () => {
    // Set up Supabase real-time subscriptions
    const winnersSubscription = db.subscribeToWinners((payload) => {
      console.log('New winner:', payload);
      update(state => ({
        ...state,
        recentWinners: [payload.new, ...state.recentWinners.slice(0, 9)],
        lastUpdate: new Date().toISOString()
      }));
    });

    const shotsSubscription = db.subscribeToShots((payload) => {
      console.log('New shot:', payload);
      
      // Notify about new shot taken (only if it's not the current user)
      const walletStore = getWalletStore();
      const wallet = get(walletStore);
      if (payload.new && payload.new.player_address !== wallet.address?.toLowerCase()) {
        const currentState = get({ subscribe });
        notifyShotTaken(currentState.currentPot || 'the current pot');
      }
      
      // Refresh game state when new shots are taken
      loadGameState();
    });

    const sponsorsSubscription = db.subscribeToSponsors((payload) => {
      console.log('New sponsor:', payload);
      update(state => ({
        ...state,
        currentSponsor: payload.new,
        lastUpdate: new Date().toISOString()
      }));
    });

    // Update every 60 seconds as fallback
    updateInterval = setInterval(async () => {
      await loadGameState();
      
      const walletStore = getWalletStore();
      const wallet = get(walletStore);
      if (wallet.connected && wallet.address) {
        await loadPlayerData(wallet.address);
      }
    }, 60000);

    // Listen for wallet connection changes
    const walletStore = getWalletStore();
    walletStore.subscribe(async (wallet) => {
      if (wallet.connected && wallet.address) {
        await loadPlayerData(wallet.address);
      }
    });

    // Store subscriptions for cleanup
    updateInterval = {
      timer: updateInterval,
      subscriptions: [winnersSubscription, shotsSubscription, sponsorsSubscription]
    };
  };

  // Stop real-time updates
  const stopRealTimeUpdates = () => {
    if (updateInterval) {
      if (updateInterval.timer) {
        clearInterval(updateInterval.timer);
      }
      if (updateInterval.subscriptions) {
        updateInterval.subscriptions.forEach(subscription => {
          if (subscription && subscription.unsubscribe) {
            subscription.unsubscribe();
          }
        });
      }
      updateInterval = null;
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return {
    subscribe,
    init,
    switchCrypto,
    loadGameState,
    loadPlayerData,
    takeShot,
    sponsorRound,
    shareOnTwitter,
    copyLink,
    formatTimeRemaining,
    stopRealTimeUpdates,
    // Notification management
    requestNotificationPermission: () => notificationManager.requestPermission(),
    getNotificationPermissionStatus: () => notificationManager.getPermissionStatus(),
    isNotificationsEnabled: () => notificationManager.isEnabled(),
  };
};

export const gameStore = createUnifiedGameStore();

// Derived stores for convenience
export const currentPot = derived(gameStore, $game => $game.currentPot);

export const currentPotUSD = derived(gameStore, $game => $game.currentPotUSD);

export const canTakeShot = derived(gameStore, $game => $game.canShoot && !$game.takingShot);

export const cooldownRemaining = derived(gameStore, $game => $game.cooldownRemaining);

export const isLoading = derived(gameStore, $game => $game.loading || $game.takingShot);

export const currentSponsor = derived(gameStore, $game => $game.currentSponsor);

export const recentWinners = derived(gameStore, $game => $game.recentWinners);

export const playerStats = derived(gameStore, $game => $game.playerStats);

export const contractDeployed = derived(gameStore, $game => $game.contractDeployed);

export const gameError = derived(gameStore, $game => $game.error);

export const activeCrypto = derived(gameStore, $game => $game.activeCrypto);

export const gameConfig = derived(gameStore, $game => $game.gameConfig);

export const shotCost = derived(gameStore, $game => $game.shotCost);

export const shotCostUSD = derived(gameStore, $game => $game.shotCostUSD);

export const sponsorCost = derived(gameStore, $game => $game.sponsorCost);

export const sponsorCostUSD = derived(gameStore, $game => $game.sponsorCostUSD);

export const isMultiCryptoMode = derived(gameStore, $game => $game.isMultiCryptoMode);

// Legacy exports for backward compatibility
export const multiCryptoGameStore = gameStore;