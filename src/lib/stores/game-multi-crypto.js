// Multi-cryptocurrency game store
// Refactored to support multiple cryptocurrencies using the adapter pattern

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { multiCryptoWalletStore } from './wallet-multi-crypto.js';
import { toastStore } from './toast.js';
import { db, formatAddress, formatTimeAgo } from '../supabase.js';
import { getActiveAdapter } from '../crypto/adapters/index.js';
import { getCryptoGameConfig, getCurrentCrypto } from '../crypto/config.js';
import { UI_CONFIG } from '../config.js';
import { shareOnTwitter as shareOnTwitterExternal } from '../utils/external-links.js';

// Winner event store for triggering animations
export const winnerEventStore = writable(null);

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

// Multi-crypto game state store
const createMultiCryptoGameStore = () => {
  const { subscribe, set, update } = writable({
    // Contract/Program info
    contractAddress: '',
    contractDeployed: null, // null = unknown, true = deployed, false = not deployed

    // Game state
    currentPot: '0',
    shotCost: '0',
    sponsorCost: '0',
    
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
    activeCrypto: null,
    gameConfig: null,
    
    // Real-time updates
    lastUpdate: null,
  });

  let updateInterval = null;

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

  // Initialize game store
  const init = async (cryptoType = null) => {
    if (!browser) {
      console.warn('Multi-crypto game initialization skipped on server');
      return;
    }

    try {
      // Determine which crypto to use
      const targetCrypto = cryptoType || getCurrentCrypto().type;
      const gameConfig = getCryptoGameConfig(targetCrypto);

      update(state => ({
        ...state,
        activeCrypto: targetCrypto,
        gameConfig,
        loading: true,
        error: null
      }));

      // Get the adapter for this crypto
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
        
        // Load initial game state
        await loadGameState();
        
        // Start real-time updates
        startRealTimeUpdates();
        
        update(state => ({
          ...state,
          loading: false,
          lastUpdate: new Date().toISOString()
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
      }
      
    } catch (error) {
      console.error('Failed to initialize multi-crypto game:', error);
      
      let errorMessage = `Failed to initialize ${cryptoType || 'game'}: ${error.message}`;
      if (error.message.includes('not yet implemented')) {
        errorMessage = error.message;
      }
      
      update(state => ({
        ...state,
        contractDeployed: false,
        loading: false,
        error: errorMessage
      }));
    }
  };

  // Switch to a different cryptocurrency
  const switchCrypto = async (cryptoType) => {
    if (!browser) return;

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
      await init(cryptoType);

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

    const adapter = getActiveAdapter();
    if (!adapter) {
      console.warn('No active adapter for loading game state');
      return;
    }

    try {
      // Check cache first for contract data
      let contractBalance = rpcCache.get('contractBalance');
      let houseFunds = rpcCache.get('houseFunds');
      let shotCost = rpcCache.get('shotCost');
      let sponsorCost = rpcCache.get('sponsorCost');
      let currentSponsor = rpcCache.get('currentSponsor');
      let recentWinners = rpcCache.get('recentWinners');

      // Only fetch from contract if not cached
      const contractCalls = [];
      if (!contractBalance) contractCalls.push(['contractBalance', () => adapter.getContractBalance()]);
      if (!houseFunds) contractCalls.push(['houseFunds', () => adapter.getHouseFunds()]);
      if (!shotCost) contractCalls.push(['shotCost', () => adapter.getShotCost()]);
      if (!sponsorCost) contractCalls.push(['sponsorCost', () => adapter.getSponsorCost()]);
      if (!currentSponsor) contractCalls.push(['currentSponsor', () => adapter.getCurrentSponsor()]);
      if (!recentWinners) contractCalls.push(['recentWinners', () => adapter.getRecentWinners()]);

      // Execute only necessary contract calls with longer delays
      if (contractCalls.length > 0) {
        console.log(`Making ${contractCalls.length} RPC calls (${6 - contractCalls.length} cached)`);
        
        // Execute calls sequentially to avoid rate limiting
        for (const [key, call] of contractCalls) {
          try {
            const result = await retryWithBackoff(call, 2, 2000);
            rpcCache.set(key, result);
            
            // Assign to variables
            if (key === 'contractBalance') contractBalance = result;
            else if (key === 'houseFunds') houseFunds = result;
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
            if (key === 'contractBalance') contractBalance = contractBalance || '0';
            else if (key === 'houseFunds') houseFunds = houseFunds || '0';
            else if (key === 'shotCost') shotCost = shotCost || '0';
            else if (key === 'sponsorCost') sponsorCost = sponsorCost || '0';
            else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
            else if (key === 'recentWinners') recentWinners = recentWinners || [];
          }
        }
      }

      // Calculate actual pot (contract balance minus house funds)
      const actualPot = await adapter.getCurrentPot();
      
      console.log('💰 Current pot:', actualPot);

      // Load database data (prioritize this over contract data)
      const [dbWinners, dbStats, dbSponsors, topPlayers] = await Promise.all([
        db.getRecentWinners(10),
        db.getGameStats(),
        db.getCurrentSponsor(),
        db.getTopPlayers(10)
      ]);

      // Use database data when available, fallback to contract data
      const winners = dbWinners.length > 0 ? dbWinners : (recentWinners || []);
      const sponsor = dbSponsors || (currentSponsor?.active ? currentSponsor : null);

      update(state => ({
        ...state,
        currentPot: actualPot || '0',
        shotCost: shotCost || '0',
        sponsorCost: sponsorCost || '0',
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

    const adapter = getActiveAdapter();
    if (!adapter) return;

    try {
      const [playerStats, canShoot, cooldownRemaining] = await Promise.all([
        adapter.getPlayerStats(address),
        adapter.canTakeShot(address),
        adapter.getCooldownRemaining(address)
      ]);

      // Also load player data from database for additional stats
      const dbPlayerStats = await db.getPlayer(address);

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
    console.log('🎯 Multi-crypto gameStore.takeShot() called!');
    
    if (!browser) {
      console.log('❌ Not in browser environment');
      toastStore.error('Not available on server');
      return;
    }

    const wallet = get(multiCryptoWalletStore);
    console.log('👛 Wallet state:', {
      connected: wallet.connected,
      address: wallet.address,
      activeCrypto: wallet.activeCrypto
    });
    
    if (!wallet.connected || !wallet.address) {
      console.log('❌ Wallet not connected');
      toastStore.error('Please connect your wallet first');
      return;
    }

    const adapter = getActiveAdapter();
    if (!adapter) {
      console.log('❌ No active adapter');
      toastStore.error('No active cryptocurrency adapter');
      return;
    }

    const currentState = get({ subscribe });
    console.log('🎮 Game state:', {
      contractDeployed: currentState.contractDeployed,
      activeCrypto: currentState.activeCrypto,
      loading: currentState.loading,
      takingShot: currentState.takingShot
    });
    
    if (currentState.contractDeployed === false) {
      console.log('❌ Contract not deployed');
      toastStore.error(`${currentState.activeCrypto} contract not deployed yet.`);
      return;
    }

    console.log('✅ All takeShot checks passed, starting transaction...');

    try {
      update(state => ({ ...state, takingShot: true, error: null }));

      // Use adapter to take shot
      const result = await adapter.takeShot();
      
      console.log('✅ Shot transaction completed:', result.hash);
      
      if (result.won) {
        toastStore.success('🎉 JACKPOT! You won the pot!');
        
        // Trigger winner animation
        winnerEventStore.set({
          winner: wallet.address,
          amount: currentState.currentPot,
          timestamp: new Date().toISOString()
        });
      } else {
        toastStore.info('Shot taken! Better luck next time.');
      }

      // Log transaction to database
      try {
        console.log('📝 Recording shot to database...');

        const shotRecord = await db.recordShot({
          playerAddress: wallet.address,
          amount: currentState.shotCost,
          won: result.won,
          txHash: result.hash,
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          cryptoType: currentState.activeCrypto
        });

        console.log('✅ Shot recorded successfully:', shotRecord?.id);

        if (result.won) {
          console.log('🏆 Recording winner to database...');
          const winnerRecord = await db.recordWinner({
            winnerAddress: wallet.address,
            amount: currentState.currentPot,
            txHash: result.hash,
            blockNumber: result.receipt.blockNumber,
            timestamp: new Date().toISOString(),
            cryptoType: currentState.activeCrypto
          });
          console.log('✅ Winner recorded successfully:', winnerRecord?.id);
        }

        // Update player record
        console.log('👤 Updating player record...');
        const existingPlayer = await db.getPlayer(wallet.address);
        
        const newTotalShots = (existingPlayer?.total_shots || 0) + 1;
        const newTotalSpent = parseFloat(existingPlayer?.total_spent || '0') + parseFloat(currentState.shotCost);
        const newTotalWon = result.won ?
          parseFloat(existingPlayer?.total_won || '0') + parseFloat(currentState.currentPot) :
          parseFloat(existingPlayer?.total_won || '0');

        const playerData = {
          address: wallet.address,
          totalShots: newTotalShots,
          totalSpent: newTotalSpent.toString(),
          totalWon: newTotalWon.toString(),
          lastShotTime: new Date().toISOString(),
          cryptoType: currentState.activeCrypto
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
      await multiCryptoWalletStore.updateBalance();

    } catch (error) {
      console.error('Failed to take shot:', error);
      
      let errorMessage = 'Failed to take shot';
      if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient ${currentState.activeCrypto} balance`;
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

    const wallet = get(multiCryptoWalletStore);
    if (!wallet.connected || !wallet.address) {
      toastStore.error('Please connect your wallet first');
      return;
    }

    const adapter = getActiveAdapter();
    if (!adapter) {
      toastStore.error('No active cryptocurrency adapter');
      return;
    }

    const currentState = get({ subscribe });
    if (currentState.contractDeployed === false) {
      toastStore.error(`${currentState.activeCrypto} contract not deployed yet.`);
      return;
    }

    if (!name || !logoUrl) {
      toastStore.error('Please provide sponsor name and logo URL');
      return;
    }

    try {
      // Use adapter to sponsor round
      const result = await adapter.sponsorRound(name, logoUrl);
      
      toastStore.success('Round sponsored successfully!');
      
      // Log sponsorship to database
      try {
        await db.recordSponsor({
          sponsorAddress: wallet.address,
          name,
          logoUrl,
          sponsorUrl,
          amount: currentState.sponsorCost,
          txHash: result.hash,
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          active: true,
          cryptoType: currentState.activeCrypto
        });
      } catch (dbError) {
        console.error('Failed to log sponsorship to database:', dbError);
      }
      
      // Clear cache and refresh state
      rpcCache.clear();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadGameState();
      await multiCryptoWalletStore.updateBalance();

    } catch (error) {
      console.error('Failed to sponsor round:', error);
      
      let errorMessage = 'Failed to sponsor round';
      if (error.message.includes('insufficient funds')) {
        errorMessage = `Insufficient ${currentState.activeCrypto} balance`;
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
    const text = `I just took a shot at #${cryptoSymbol}Shot and the pot is now ${potValue}! 🎯 Try your luck:`;
    const url = 'https://ethshot.io'; // TODO: Make this configurable
    
    console.log('🐦 Sharing on X:', { currentPot: state.currentPot, cryptoSymbol, potValue, text });
    
    // Use the external links utility to properly handle webviews
    shareOnTwitterExternal(text, url);
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!browser) return;

    try {
      await navigator.clipboard.writeText('https://ethshot.io'); // TODO: Make this configurable
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

    // Update every 60 seconds as fallback
    updateInterval = setInterval(async () => {
      await loadGameState();
      
      const wallet = get(multiCryptoWalletStore);
      if (wallet.connected && wallet.address) {
        await loadPlayerData(wallet.address);
      }
    }, 60000);

    // Listen for wallet connection changes
    multiCryptoWalletStore.subscribe(async (wallet) => {
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
  };
};

export const multiCryptoGameStore = createMultiCryptoGameStore();

// Derived stores for convenience
export const currentPot = derived(multiCryptoGameStore, $game => $game.currentPot);

export const canTakeShot = derived(multiCryptoGameStore, $game => $game.canShoot && !$game.takingShot);

export const cooldownRemaining = derived(multiCryptoGameStore, $game => $game.cooldownRemaining);

export const isLoading = derived(multiCryptoGameStore, $game => $game.loading || $game.takingShot);

export const currentSponsor = derived(multiCryptoGameStore, $game => $game.currentSponsor);

export const recentWinners = derived(multiCryptoGameStore, $game => $game.recentWinners);

export const playerStats = derived(multiCryptoGameStore, $game => $game.playerStats);

export const contractDeployed = derived(multiCryptoGameStore, $game => $game.contractDeployed);

export const gameError = derived(multiCryptoGameStore, $game => $game.error);

export const activeCryptoGame = derived(multiCryptoGameStore, $game => $game.activeCrypto);

export const gameConfig = derived(multiCryptoGameStore, $game => $game.gameConfig);

export const shotCost = derived(multiCryptoGameStore, $game => $game.shotCost);

export const sponsorCost = derived(multiCryptoGameStore, $game => $game.sponsorCost);