import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { walletStore } from './wallet.js';
import { toastStore } from './toast.js';
import { db, formatAddress, formatEther, formatTimeAgo } from '../supabase.js';
import { GAME_CONFIG, NETWORK_CONFIG, SOCIAL_CONFIG, UI_CONFIG } from '../config.js';

// Winner event store for triggering animations
export const winnerEventStore = writable(null);

// ETH Shot contract ABI (simplified for key functions)
const ETH_SHOT_ABI = [
  'function takeShot() external payable',
  'function sponsorRound(string calldata name, string calldata logoUrl) external payable',
  'function getCurrentPot() external view returns (uint256)',
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
  }
};

// Game state store
const createGameStore = () => {
  const { subscribe, set, update } = writable({
    // Contract info
    contractAddress: NETWORK_CONFIG.CONTRACT_ADDRESS,
    contract: null,
    contractDeployed: null, // null = unknown, true = deployed, false = not deployed

    // Game state
    currentPot: '0',
    shotCost: GAME_CONFIG.SHOT_COST_ETH,
    sponsorCost: GAME_CONFIG.SPONSOR_COST_ETH,
    
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
    
    // Real-time updates
    lastUpdate: null,
  });

  let contract = null;
  let updateInterval = null;
  let ethers = null;

  // Helper function to create provider with retry logic
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

  // Initialize game store (browser only)
  const init = async () => {
    if (!browser) {
      console.warn('Game initialization skipped on server');
      return;
    }

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
      loading: true
    }));

    try {
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
          contractDeployed: true
        }));
        
        // Load initial game state
        await loadGameState();
        
        // Start real-time updates
        startRealTimeUpdates();
        
        update(state => ({
          ...state,
          contract,
          loading: false,
          lastUpdate: new Date().toISOString()
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
      }
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      
      let errorMessage = `Failed to connect to blockchain: ${error.message}`;
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

  // Load game state from contract and database
  const loadGameState = async () => {
    if (!browser || !contract || !ethers) return;

    try {
      // Check cache first for contract data
      let currentPot = rpcCache.get('currentPot');
      let shotCost = rpcCache.get('shotCost');
      let sponsorCost = rpcCache.get('sponsorCost');
      let currentSponsor = rpcCache.get('currentSponsor');
      let recentWinners = rpcCache.get('recentWinners');

      // Only fetch from contract if not cached
      const contractCalls = [];
      if (!currentPot) contractCalls.push(['currentPot', () => contract.getCurrentPot()]);
      if (!shotCost) contractCalls.push(['shotCost', () => contract.SHOT_COST()]);
      if (!sponsorCost) contractCalls.push(['sponsorCost', () => contract.SPONSOR_COST()]);
      if (!currentSponsor) contractCalls.push(['currentSponsor', () => contract.getCurrentSponsor()]);
      if (!recentWinners) contractCalls.push(['recentWinners', () => contract.getRecentWinners()]);

      // Execute only necessary contract calls with longer delays
      if (contractCalls.length > 0) {
        console.log(`Making ${contractCalls.length} RPC calls (${5 - contractCalls.length} cached)`);
        
        // Execute calls sequentially to avoid rate limiting
        for (const [key, call] of contractCalls) {
          try {
            const result = await retryWithBackoff(call, 2, 2000);
            rpcCache.set(key, result);
            
            // Assign to variables
            if (key === 'currentPot') currentPot = result;
            else if (key === 'shotCost') shotCost = result;
            else if (key === 'sponsorCost') sponsorCost = result;
            else if (key === 'currentSponsor') currentSponsor = result;
            else if (key === 'recentWinners') recentWinners = result;
            
            // Add delay between calls to avoid rate limiting
            if (contractCalls.indexOf([key, call]) < contractCalls.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.warn(`Failed to fetch ${key}, using cached or default value:`, error.message);
            // Use cached values or defaults
            if (key === 'currentPot') currentPot = currentPot || '0';
            else if (key === 'shotCost') shotCost = shotCost || ethers.parseEther('0.001');
            else if (key === 'sponsorCost') sponsorCost = sponsorCost || ethers.parseEther('0.001');
            else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
            else if (key === 'recentWinners') recentWinners = recentWinners || [];
          }
        }
      }

      // Load database data (prioritize this over contract data)
      const [dbWinners, dbStats, dbSponsors, topPlayers] = await Promise.all([
        db.getRecentWinners(10),
        db.getGameStats(),
        db.getCurrentSponsor(),
        db.getTopPlayers(10)
      ]);

      // Use database data when available, fallback to contract data
      const winners = dbWinners.length > 0 ? dbWinners : (recentWinners || []).map(winner => ({
        ...winner,
        amount: ethers.formatEther(winner.amount),
        timestamp: new Date(Number(winner.timestamp) * 1000).toISOString()
      }));

      const sponsor = dbSponsors || (currentSponsor?.active ? currentSponsor : null);

      update(state => ({
        ...state,
        currentPot: ethers.formatEther(currentPot || '0'),
        shotCost: ethers.formatEther(shotCost || ethers.parseEther('0.001')),
        sponsorCost: ethers.formatEther(sponsorCost || ethers.parseEther('0.001')),
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
    if (!browser || !contract || !address || !ethers) return;

    try {
      const [playerStats, canShoot, cooldownRemaining] = await Promise.all([
        contract.getPlayerStats(address),
        contract.canTakeShot(address),
        contract.getCooldownRemaining(address)
      ]);

      // Also load player data from database for additional stats
      const dbPlayerStats = await db.getPlayer(address);

      update(state => ({
        ...state,
        playerStats: {
          totalShots: Number(playerStats.totalShots),
          totalSpent: ethers.formatEther(playerStats.totalSpent),
          totalWon: ethers.formatEther(playerStats.totalWon),
          lastShotTime: new Date(Number(playerStats.lastShotTime) * 1000).toISOString(),
          // Additional stats from database
          ...dbPlayerStats
        },
        canShoot,
        cooldownRemaining: Number(cooldownRemaining),
        lastUpdate: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Failed to load player data:', error);
    }
  };

  // Take a shot at the jackpot
  const takeShot = async () => {
    if (!browser || !ethers) {
      toastStore.error('Web3 not available');
      return;
    }

    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.signer) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    const currentState = get({ subscribe });
    if (currentState.contractDeployed === false) {
      toastStore.error('Smart contract not deployed yet. Please deploy the contract first.');
      return;
    }

    if (!contract) {
      toastStore.error('Game contract not initialized. Please refresh the page.');
      return;
    }

    update(state => ({ ...state, takingShot: true, error: null }));

    try {
      // Create contract instance with signer
      const contractWithSigner = contract.connect(wallet.signer);
      const shotCost = await contract.SHOT_COST();

      // Send transaction
      const tx = await contractWithSigner.takeShot({
        value: shotCost,
        gasLimit: 150000 // Set reasonable gas limit
      });

      toastStore.info('Shot submitted! Waiting for confirmation...');

      // Wait for transaction confirmation
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
        
        if (won) {
          const potAmount = ethers.formatEther(await contract.getCurrentPot());
          toastStore.success('🎉 JACKPOT! You won the pot!');
          
          // Trigger winner animation
          winnerEventStore.set({
            winner: wallet.address,
            amount: potAmount,
            timestamp: new Date().toISOString()
          });
        } else {
          toastStore.info('Shot taken! Better luck next time.');
        }
      }

      // Log transaction to database
      try {
        await db.recordShot({
          player_address: wallet.address,
          amount: ethers.formatEther(shotCost),
          won,
          tx_hash: receipt.hash,
          block_number: receipt.blockNumber,
          timestamp: new Date().toISOString()
        });

        if (won) {
          // Also record as winner
          await db.recordWinner({
            player_address: wallet.address,
            amount: ethers.formatEther(await contract.getCurrentPot()),
            tx_hash: receipt.hash,
            block_number: receipt.blockNumber,
            timestamp: new Date().toISOString()
          });
        }
      } catch (dbError) {
        console.error('Failed to log transaction to database:', dbError);
        // Don't fail the whole transaction for database errors
      }

      // Refresh game state
      await loadGameState();
      await loadPlayerData(wallet.address);
      
      // Update wallet balance
      await walletStore.updateBalance();

    } catch (error) {
      console.error('Failed to take shot:', error);
      
      let errorMessage = 'Failed to take shot';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH balance';
      } else if (error.message.includes('Cooldown')) {
        errorMessage = 'Please wait for cooldown period';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      }
      
      toastStore.error(errorMessage);
      update(state => ({ ...state, error: errorMessage }));
    } finally {
      update(state => ({ ...state, takingShot: false }));
    }
  };

  // Sponsor a round
  const sponsorRound = async (name, logoUrl, sponsorUrl = null) => {
    if (!browser || !ethers) {
      toastStore.error('Web3 not available');
      return;
    }

    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.signer) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    const currentState = get({ subscribe });
    if (currentState.contractDeployed === false) {
      toastStore.error('Smart contract not deployed yet. Please deploy the contract first.');
      return;
    }

    if (!contract) {
      toastStore.error('Game contract not initialized. Please refresh the page.');
      return;
    }

    if (!name || !logoUrl) {
      toastStore.error('Please provide sponsor name and logo URL');
      return;
    }

    try {
      const contractWithSigner = contract.connect(wallet.signer);
      const sponsorCost = await contract.SPONSOR_COST();

      const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
        value: sponsorCost,
        gasLimit: 100000
      });

      toastStore.info('Sponsorship submitted! Waiting for confirmation...');
      const receipt = await tx.wait();
      
      toastStore.success('Round sponsored successfully!');
      
      // Log sponsorship to database
      try {
        await db.recordSponsor({
          sponsor_address: wallet.address,
          name,
          logo_url: logoUrl,
          sponsor_url: sponsorUrl,
          amount: ethers.formatEther(sponsorCost),
          tx_hash: receipt.hash,
          block_number: receipt.blockNumber,
          timestamp: new Date().toISOString(),
          active: true
        });
      } catch (dbError) {
        console.error('Failed to log sponsorship to database:', dbError);
        // Don't fail the whole transaction for database errors
      }
      
      // Refresh game state
      await loadGameState();
      await walletStore.updateBalance();

    } catch (error) {
      console.error('Failed to sponsor round:', error);
      
      let errorMessage = 'Failed to sponsor round';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH balance';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      }
      
      toastStore.error(errorMessage);
    }
  };

  // Share on Twitter
  const shareOnTwitter = () => {
    if (!browser) {
      return;
    }

    const state = get({ subscribe });
    const text = `I just took a shot at #ETHShot and the pot is now ${state.currentPot} ETH! 🎯 Try your luck:`;
    const url = SOCIAL_CONFIG.APP_URL;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!browser) {
      return;
    }

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

    // Update every 60 seconds as fallback (reduced frequency to avoid rate limiting)
    updateInterval = setInterval(async () => {
      await loadGameState();
      
      const wallet = get(walletStore);
      if (wallet.connected && wallet.address) {
        await loadPlayerData(wallet.address);
      }
    }, 60000);

    // Listen for wallet connection changes
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
    loadGameState,
    loadPlayerData,
    takeShot,
    sponsorRound,
    shareOnTwitter,
    copyLink,
    formatTimeRemaining,
    stopRealTimeUpdates,
  };
};

export const gameStore = createGameStore();

// Derived stores for convenience
export const currentPot = derived(gameStore, $game => $game.currentPot);

export const canTakeShot = derived(gameStore, $game => $game.canShoot && !$game.takingShot);

export const cooldownRemaining = derived(gameStore, $game => $game.cooldownRemaining);

export const isLoading = derived(gameStore, $game => $game.loading || $game.takingShot);

export const currentSponsor = derived(gameStore, $game => $game.currentSponsor);

export const recentWinners = derived(gameStore, $game => $game.recentWinners);

export const playerStats = derived(gameStore, $game => $game.playerStats);

export const contractDeployed = derived(gameStore, $game => $game.contractDeployed);

export const gameError = derived(gameStore, $game => $game.error);