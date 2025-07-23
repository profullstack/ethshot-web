import { writable, derived, get } from 'svelte/store';
import { ethers } from 'ethers';
import { walletStore } from './wallet.js';
import { toastStore } from './toast.js';
import { db, formatAddress, formatEther, formatTimeAgo } from '../supabase.js';

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

// Game state store
const createGameStore = () => {
  const { subscribe, set, update } = writable({
    // Contract info
    contractAddress: import.meta.env.PUBLIC_CONTRACT_ADDRESS || '',
    contract: null,
    
    // Game state
    currentPot: '0',
    shotCost: '0.001',
    sponsorCost: '0.05',
    
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

  // Initialize game store
  const init = async () => {
    const contractAddress = import.meta.env.PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
      console.warn('Contract address not configured');
      return;
    }

    update(state => ({ 
      ...state, 
      contractAddress,
      loading: true 
    }));

    try {
      // Create contract instance with read-only provider
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/demo'
      );
      
      contract = new ethers.Contract(contractAddress, ETH_SHOT_ABI, provider);
      
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
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      update(state => ({ 
        ...state, 
        loading: false,
        error: error.message 
      }));
    }
  };

  // Load game state from contract and database
  const loadGameState = async () => {
    if (!contract) return;

    try {
      // Load contract data
      const [
        currentPot,
        shotCost,
        sponsorCost,
        currentSponsor,
        recentWinners
      ] = await Promise.all([
        contract.getCurrentPot(),
        contract.SHOT_COST(),
        contract.SPONSOR_COST(),
        contract.getCurrentSponsor(),
        contract.getRecentWinners()
      ]);

      // Load database data (more comprehensive and faster)
      const [dbWinners, dbStats, dbSponsors, topPlayers] = await Promise.all([
        db.getRecentWinners(10),
        db.getGameStats(),
        db.getCurrentSponsor(),
        db.getTopPlayers(10)
      ]);

      // Use database data when available, fallback to contract data
      const winners = dbWinners.length > 0 ? dbWinners : recentWinners.map(winner => ({
        ...winner,
        amount: ethers.formatEther(winner.amount),
        timestamp: new Date(Number(winner.timestamp) * 1000).toISOString()
      }));

      const sponsor = dbSponsors || (currentSponsor.active ? currentSponsor : null);

      update(state => ({
        ...state,
        currentPot: ethers.formatEther(currentPot),
        shotCost: ethers.formatEther(shotCost),
        sponsorCost: ethers.formatEther(sponsorCost),
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
    if (!contract || !address) return;

    try {
      const [playerStats, canShoot, cooldownRemaining] = await Promise.all([
        contract.getPlayerStats(address),
        contract.canTakeShot(address),
        contract.getCooldownRemaining(address)
      ]);

      // Also load player data from database for additional stats
      const dbPlayerStats = await db.getPlayerStats(address);

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
    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.signer || !contract) {
      toastStore.error('Please connect your wallet first');
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
  const sponsorRound = async (name, logoUrl) => {
    const wallet = get(walletStore);
    if (!wallet.connected || !wallet.signer || !contract) {
      toastStore.error('Please connect your wallet first');
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
    const state = get({ subscribe });
    const text = `I just took a shot at #ETHShot and the pot is now ${state.currentPot} ETH! 🎯 Try your luck:`;
    const url = 'https://ethshot.io';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
  };

  // Copy link to clipboard
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://ethshot.io');
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

    // Update every 30 seconds as fallback
    updateInterval = setInterval(async () => {
      await loadGameState();
      
      const wallet = get(walletStore);
      if (wallet.connected && wallet.address) {
        await loadPlayerData(wallet.address);
      }
    }, 30000);

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