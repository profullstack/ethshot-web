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
      let contractBalance = rpcCache.get('contractBalance');
      let houseFunds = rpcCache.get('houseFunds');
      let shotCost = rpcCache.get('shotCost');
      let sponsorCost = rpcCache.get('sponsorCost');
      let currentSponsor = rpcCache.get('currentSponsor');
      let recentWinners = rpcCache.get('recentWinners');

      // Only fetch from contract if not cached
      const contractCalls = [];
      if (!contractBalance) contractCalls.push(['contractBalance', () => contract.getContractBalance()]);
      if (!houseFunds) contractCalls.push(['houseFunds', () => contract.getHouseFunds()]);
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
            else if (key === 'shotCost') shotCost = shotCost || ethers.parseEther('0.001');
            else if (key === 'sponsorCost') sponsorCost = sponsorCost || ethers.parseEther('0.001');
            else if (key === 'currentSponsor') currentSponsor = currentSponsor || { active: false };
            else if (key === 'recentWinners') recentWinners = recentWinners || [];
          }
        }
      }

      // Calculate actual pot (contract balance minus house funds)
      console.log('🔍 Contract values:', {
        contractBalance: contractBalance?.toString(),
        houseFunds: houseFunds?.toString(),
        contractBalanceEth: contractBalance ? ethers.formatEther(contractBalance) : 'N/A',
        houseFundsEth: houseFunds ? ethers.formatEther(houseFunds) : 'N/A',
        contractBalanceType: typeof contractBalance,
        houseFundsType: typeof houseFunds,
        contractBalanceFromCache: !!rpcCache.get('contractBalance'),
        houseFundsFromCache: !!rpcCache.get('houseFunds')
      });
      
      const actualPot = contractBalance && houseFunds ?
        BigInt(contractBalance) - BigInt(houseFunds) :
        BigInt(contractBalance || '0');
        
      console.log('💰 Calculated pot:', {
        actualPot: actualPot.toString(),
        actualPotEth: ethers.formatEther(actualPot),
        calculation: `${contractBalance?.toString()} - ${houseFunds?.toString()} = ${actualPot.toString()}`
      });
      
      // Force fresh contract calls if pot seems wrong
      if (ethers.formatEther(actualPot) === '0.001') {
        console.log('🚨 Pot is 0.001 ETH - forcing fresh contract calls to verify');
        try {
          const freshContractBalance = await contract.getContractBalance();
          const freshHouseFunds = await contract.getHouseFunds();
          console.log('🔄 Fresh contract data:', {
            freshContractBalance: freshContractBalance.toString(),
            freshHouseFunds: freshHouseFunds.toString(),
            freshContractBalanceEth: ethers.formatEther(freshContractBalance),
            freshHouseFundsEth: ethers.formatEther(freshHouseFunds),
            freshPotEth: ethers.formatEther(freshContractBalance - freshHouseFunds)
          });
          
          // Use fresh data if different
          if (freshContractBalance.toString() !== contractBalance?.toString() ||
              freshHouseFunds.toString() !== houseFunds?.toString()) {
            console.log('📊 Using fresh data instead of cached data');
            contractBalance = freshContractBalance;
            houseFunds = freshHouseFunds;
            actualPot = BigInt(contractBalance) - BigInt(houseFunds);
            
            // Update cache with fresh data
            rpcCache.set('contractBalance', contractBalance);
            rpcCache.set('houseFunds', houseFunds);
          }
        } catch (freshError) {
          console.error('❌ Failed to fetch fresh contract data:', freshError);
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
        currentPot: ethers.formatEther(actualPot),
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
    console.log('🎯 gameStore.takeShot() called!');
    console.log('🔍 Starting takeShot function...');
    
    if (!browser || !ethers) {
      console.log('❌ Web3 not available - browser:', browser, 'ethers:', !!ethers);
      toastStore.error('Web3 not available');
      return;
    }

    const wallet = get(walletStore);
    console.log('👛 Wallet state:', {
      connected: wallet.connected,
      hasSigner: !!wallet.signer,
      address: wallet.address,
      provider: !!wallet.provider,
      chainId: wallet.chainId
    });
    
    if (!wallet.connected || !wallet.signer) {
      console.log('❌ Wallet not connected or no signer');
      toastStore.error('Please connect your wallet first');
      return;
    }

    const currentState = get({ subscribe });
    console.log('🎮 Game state:', {
      contractDeployed: currentState.contractDeployed,
      hasContract: !!contract,
      contractAddress: currentState.contractAddress,
      loading: currentState.loading,
      takingShot: currentState.takingShot
    });
    
    if (currentState.contractDeployed === false) {
      console.log('❌ Contract not deployed');
      toastStore.error('Smart contract not deployed yet. Please deploy the contract first.');
      return;
    }

    if (!contract) {
      console.log('❌ Contract not initialized');
      toastStore.error('Game contract not initialized. Please refresh the page.');
      return;
    }

    console.log('✅ All takeShot checks passed, starting transaction...');

    try {
      // Create contract instance with signer
      console.log('🔗 Connecting contract with signer...');
      console.log('🔗 Contract address:', contract.target || contract.address);
      console.log('🔗 Signer address:', await wallet.signer.getAddress());
      
      const contractWithSigner = contract.connect(wallet.signer);
      console.log('✅ Contract connected with signer');
      
      console.log('💰 Getting shot cost from contract...');
      const shotCost = await contract.SHOT_COST();
      console.log('💰 Shot cost:', ethers.formatEther(shotCost), 'ETH');
      console.log('💰 Shot cost (wei):', shotCost.toString());

      // Check user balance
      const balance = await wallet.provider.getBalance(wallet.address);
      console.log('💳 User balance:', ethers.formatEther(balance), 'ETH');
      
      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await contractWithSigner.takeShot.estimateGas({
          value: shotCost
        });
        console.log('⛽ Gas estimate for takeShot:', gasEstimate.toString());
      } catch (estimateError) {
        console.warn('Failed to estimate gas for takeShot, using default:', estimateError.message);
        gasEstimate = 150000n; // Fallback gas limit
      }
      
      // Add 20% buffer to gas estimate, but cap at reasonable limit
      const gasLimit = gasEstimate < 120000n ? 150000n : gasEstimate + (gasEstimate * 20n / 100n);
      console.log('⛽ Using gas limit for takeShot:', gasLimit.toString());
      
      // Get current gas price and calculate total cost
      const feeData = await wallet.provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      const estimatedGasCost = gasLimit * gasPrice;
      const totalCost = shotCost + estimatedGasCost;
      
      console.log('💸 Shot cost:', ethers.formatEther(shotCost), 'ETH');
      console.log('💸 Estimated gas cost:', ethers.formatEther(estimatedGasCost), 'ETH');
      console.log('💸 Total estimated cost:', ethers.formatEther(totalCost), 'ETH');
      
      if (balance < totalCost) {
        const shortfall = ethers.formatEther(totalCost - balance);
        console.log('❌ Insufficient balance for total cost');
        toastStore.error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
        return;
      }

      // Send transaction - this will trigger wallet approval dialog
      console.log('📤 Sending takeShot transaction...');
      console.log('📤 Transaction params:', {
        value: shotCost.toString(),
        gasLimit: gasLimit.toString()
      });
      
      console.log('🔍 About to call contractWithSigner.takeShot()...');
      console.log('🔍 This should trigger Phantom approval dialog...');
      
      let tx;
      try {
        tx = await contractWithSigner.takeShot({
          value: shotCost,
          gasLimit: gasLimit
        });
        console.log('✅ Transaction created successfully:', tx.hash);
        
        // Only set loading state AFTER user approves transaction
        console.log('🔄 Setting takingShot to true after approval...');
        update(state => ({ ...state, takingShot: true, error: null }));
        
      } catch (txError) {
        console.error('❌ Transaction creation failed:', txError);
        console.error('❌ Error details:', {
          message: txError.message,
          code: txError.code,
          reason: txError.reason,
          action: txError.action
        });
        throw txError;
      }

      console.log('✅ Transaction sent:', tx.hash);
      console.log('✅ Transaction object:', tx);
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
        console.log('📝 Recording shot to database...', {
          playerAddress: wallet.address,
          amount: ethers.formatEther(shotCost),
          won,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber
        });

        const shotRecord = await db.recordShot({
          playerAddress: wallet.address,
          amount: ethers.formatEther(shotCost),
          won,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          timestamp: new Date().toISOString()
        });

        console.log('✅ Shot recorded successfully:', shotRecord?.id);

        if (won) {
          console.log('🏆 Recording winner to database...');
          // Also record as winner
          const currentPot = await contract.getCurrentPot();
          const winnerRecord = await db.recordWinner({
            winnerAddress: wallet.address,
            amount: ethers.formatEther(currentPot),
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            timestamp: new Date().toISOString()
          });
          console.log('✅ Winner recorded successfully:', winnerRecord?.id);
        }

        // Update or create player record
        console.log('👤 Updating player record...');
        const existingPlayer = await db.getPlayer(wallet.address);
        console.log('👤 Existing player data:', existingPlayer);
        
        const newTotalShots = (existingPlayer?.total_shots || 0) + 1;
        const newTotalSpent = parseFloat(existingPlayer?.total_spent || '0') + parseFloat(ethers.formatEther(shotCost));
        const newTotalWon = won ?
          parseFloat(existingPlayer?.total_won || '0') + parseFloat(ethers.formatEther(await contract.getCurrentPot())) :
          parseFloat(existingPlayer?.total_won || '0');

        const playerData = {
          address: wallet.address,
          totalShots: newTotalShots,
          totalSpent: newTotalSpent.toString(),
          totalWon: newTotalWon.toString(),
          lastShotTime: new Date().toISOString()
        };

        console.log('👤 Upserting player with data:', playerData);
        const playerRecord = await db.upsertPlayer(playerData);
        console.log('✅ Player record updated successfully:', playerRecord?.address);

      } catch (dbError) {
        console.error('❌ Failed to log transaction to database:', dbError);
        console.error('❌ Database error details:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        });
        
        // Show user-friendly error message
        toastStore.error('Shot successful but failed to update leaderboard. Please refresh the page.');
        
        // Don't fail the whole transaction for database errors, but make it visible
      }

      // Clear ALL cache to force fresh data fetch
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

      // Check user balance including gas costs
      const balance = await wallet.provider.getBalance(wallet.address);
      console.log('💳 User balance:', ethers.formatEther(balance), 'ETH');
      console.log('💰 Sponsor cost:', ethers.formatEther(sponsorCost), 'ETH');
      
      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await contractWithSigner.sponsorRound.estimateGas(name, logoUrl, {
          value: sponsorCost
        });
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (estimateError) {
        console.warn('Failed to estimate gas, using default:', estimateError.message);
        gasEstimate = 100000n; // Fallback to lower gas limit
      }
      
      // Add 20% buffer to gas estimate, but cap at reasonable limit
      const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
      console.log('⛽ Using gas limit:', gasLimit.toString());
      
      // Get current gas price
      const feeData = await wallet.provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      const estimatedGasCost = gasLimit * gasPrice;
      const totalCost = sponsorCost + estimatedGasCost;
      
      console.log('💸 Estimated gas cost:', ethers.formatEther(estimatedGasCost), 'ETH');
      console.log('💸 Total estimated cost:', ethers.formatEther(totalCost), 'ETH');
      
      if (balance < totalCost) {
        const shortfall = ethers.formatEther(totalCost - balance);
        toastStore.error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
        return;
      }

      const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
        value: sponsorCost,
        gasLimit: gasLimit
      });

      toastStore.info('Sponsorship submitted! Waiting for confirmation...');
      const receipt = await tx.wait();
      
      toastStore.success('Round sponsored successfully!');
      
      // Log sponsorship to database
      try {
        await db.recordSponsor({
          sponsorAddress: wallet.address,
          name,
          logoUrl,
          sponsorUrl,
          amount: ethers.formatEther(sponsorCost),
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          timestamp: new Date().toISOString(),
          active: true
        });
      } catch (dbError) {
        console.error('Failed to log sponsorship to database:', dbError);
        // Don't fail the whole transaction for database errors
      }
      
      // Clear ALL cache to force fresh data fetch
      rpcCache.clear();
      
      // Add a small delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh game state with fresh data
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