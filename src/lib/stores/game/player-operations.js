/**
 * Player Operations Module
 * 
 * Handles player-specific operations including stats, shots, and sponsorships
 */

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { getActiveAdapter } from '../../crypto/adapters/index.js';
import { toastStore } from '../toast.js';
import { winnerEventStore } from './core.js';
import { rpcCache } from './cache.js';
import { 
  notifyJackpotWon,
  scheduleCooldownNotification
} from '../../utils/notifications.js';

/**
 * Load player-specific data
 * @param {Object} params - Parameters object
 * @param {string} params.address - Player wallet address
 * @param {Object} params.state - Current game state
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Object} params.db - Database instance
 * @param {Function} params.updateState - State update function
 */
export const loadPlayerData = async ({ address, state, contract, ethers, db, updateState }) => {
  if (!browser || !address) return;

  try {
    let playerStats, canShoot, cooldownRemaining;

    if (state.isMultiCryptoMode) {
      // Multi-crypto mode: use adapter with batched calls for efficiency
      const adapter = getActiveAdapter();
      if (!adapter) return;

      // Use batched contract calls to reduce RPC requests
      try {
        const batchCalls = [
          { method: 'getPlayerStats', params: [address] },
          { method: 'canCommitShot', params: [address] },
          { method: 'getCooldownRemaining', params: [address] }
        ];

        const [playerStatsResult, canShootResult, cooldownResult] = await adapter.batchContractCalls(batchCalls);
        
        playerStats = {
          totalShots: Number(playerStatsResult[0].totalShots),
          totalSpent: adapter.ethers.formatEther(playerStatsResult[0].totalSpent),
          totalWon: adapter.ethers.formatEther(playerStatsResult[0].totalWon),
          lastShotTime: new Date(Number(playerStatsResult[0].lastShotTime) * 1000).toISOString(),
        };
        canShoot = canShootResult[0];
        cooldownRemaining = Number(cooldownResult[0]);
      } catch (batchError) {
        console.warn('Batch call failed, falling back to individual calls:', batchError.message);
        
        // Fallback to individual calls with error handling
        [playerStats, canShoot, cooldownRemaining] = await Promise.allSettled([
          adapter.getPlayerStats(address),
          adapter.canTakeShot(address),
          adapter.getCooldownRemaining(address)
        ]).then(results => [
          results[0].status === 'fulfilled' ? results[0].value : {
            totalShots: 0,
            totalSpent: '0',
            totalWon: '0',
            lastShotTime: new Date().toISOString()
          },
          results[1].status === 'fulfilled' ? results[1].value : false,
          results[2].status === 'fulfilled' ? results[2].value : 0
        ]);
      }
    } else {
      // ETH-only mode: direct contract calls with error handling
      if (!contract) return;

      try {
        [playerStats, canShoot, cooldownRemaining] = await Promise.allSettled([
          contract.getPlayerStats(address),
          contract.canCommitShot(address),
          contract.getCooldownRemaining(address)
        ]).then(results => [
          results[0].status === 'fulfilled' ? results[0].value : {
            totalShots: 0n,
            totalSpent: 0n,
            totalWon: 0n,
            lastShotTime: 0n
          },
          results[1].status === 'fulfilled' ? results[1].value : false,
          results[2].status === 'fulfilled' ? results[2].value : 0n
        ]);

        // Format ETH-specific data
        playerStats = {
          totalShots: Number(playerStats.totalShots),
          totalSpent: ethers.formatEther(playerStats.totalSpent),
          totalWon: ethers.formatEther(playerStats.totalWon),
          lastShotTime: new Date(Number(playerStats.lastShotTime) * 1000).toISOString(),
        };

        cooldownRemaining = Number(cooldownRemaining);
      } catch (error) {
        console.warn('Failed to load player data from contract:', error.message);
        
        // Provide fallback values
        playerStats = {
          totalShots: 0,
          totalSpent: '0',
          totalWon: '0',
          lastShotTime: new Date().toISOString(),
        };
        canShoot = false;
        cooldownRemaining = 0;
      }
    }

    // Also load player data from database for additional stats
    const dbPlayerStats = await db.getPlayer(address);

    // Load referral data and ensure user has a referral code
    const [availableDiscounts, referralStats] = await Promise.all([
      db.getUserDiscounts(address),
      db.getReferralStats(address)
    ]);

    // Create referral code if user doesn't have one
    if (!referralStats || !referralStats.referral_code) {
      try {
        console.log('🔗 Creating referral code for new user:', address);
        await db.createReferralCode(address);
        
        // Reload referral stats after creating code
        const updatedReferralStats = await db.getReferralStats(address);
        
        updateState(state => ({
          ...state,
          referralStats: updatedReferralStats
        }));
        
        console.log('✅ Referral code created successfully');
      } catch (error) {
        console.error('❌ Failed to create referral code:', error);
        // Don't throw error, just log it - referral system is optional
      }
    }

    // Schedule cooldown notification if player has cooldown
    if (cooldownRemaining > 0) {
      scheduleCooldownNotification(cooldownRemaining);
      console.log(`🔔 Scheduled cooldown notification for ${cooldownRemaining} seconds`);
    }

    updateState(state => ({
      ...state,
      playerStats: {
        ...playerStats,
        // Additional stats from database
        ...dbPlayerStats
      },
      canShoot,
      cooldownRemaining,
      availableDiscounts,
      referralStats,
      lastUpdate: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Failed to load player data:', error);
  }
};

/**
 * Take a shot at the jackpot (with discount support)
 * @param {Object} params - Parameters object
 * @param {boolean} params.useDiscount - Whether to use a discount
 * @param {string} params.discountId - Discount ID to use
 * @param {Object} params.state - Current game state
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.db - Database instance
 * @param {Function} params.updateState - State update function
 * @param {Function} params.loadGameState - Function to reload game state
 * @param {Function} params.loadPlayerData - Function to reload player data
 * @param {Object} params.walletStore - Wallet store instance
 */
export const takeShot = async ({ 
  useDiscount = false, 
  discountId = null, 
  state, 
  contract, 
  ethers, 
  wallet, 
  db, 
  updateState, 
  loadGameState, 
  loadPlayerData, 
  walletStore 
}) => {
  console.log('🎯 Player takeShot() called!', { useDiscount, discountId });
  
  if (!browser) {
    console.log('❌ Not in browser environment');
    toastStore.error('Not available on server');
    return;
  }
  
  console.log('👛 Wallet state:', {
    connected: wallet.connected,
    address: wallet.address,
    activeCrypto: wallet.activeCrypto || 'ETH',
    availableDiscounts: state.availableDiscounts?.length || 0
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

  // Check if user wants to use discount but doesn't have any or didn't provide discount ID
  if (useDiscount && (!state.availableDiscounts?.length || !discountId)) {
    console.log('❌ No discounts available or discount ID not provided');
    toastStore.error('No discounts available');
    return;
  }

  console.log('✅ All takeShot checks passed, starting transaction...');

  try {
    updateState(state => ({ ...state, takingShot: true, error: null }));

    let result;
    let actualShotCost = state.shotCost; // Default to full shot cost
    let discountApplied = false;
    let discountPercentage = 0;

    // Handle discount logic
    if (useDiscount && discountId) {
      console.log('💰 Applying discount...');
      
      // Use the discount
      const discountResult = await db.useReferralDiscount(discountId, wallet.address);
      if (!discountResult || !discountResult.success) {
        throw new Error(discountResult?.message || 'Failed to apply discount. Please try again.');
      }

      discountPercentage = discountResult.discount_percentage;
      const discountAmount = parseFloat(state.shotCost) * discountPercentage;
      actualShotCost = (parseFloat(state.shotCost) - discountAmount).toString();
      discountApplied = true;

      console.log('✅ Discount applied:', {
        originalCost: state.shotCost,
        discountPercentage: `${(discountPercentage * 100).toFixed(0)}%`,
        discountAmount: discountAmount.toFixed(6),
        finalCost: actualShotCost
      });

      toastStore.info(`🎉 ${(discountPercentage * 100).toFixed(0)}% discount applied! Shot cost: ${parseFloat(actualShotCost).toFixed(4)} ${state.activeCrypto}`);
      
      // Update available discounts
      const newAvailableDiscounts = await db.getUserDiscounts(wallet.address);
      updateState(state => ({
        ...state,
        availableDiscounts: newAvailableDiscounts
      }));
    }

    // Execute the shot transaction
    if (state.isMultiCryptoMode) {
      // Multi-crypto mode: use adapter
      const adapter = getActiveAdapter();
      if (!adapter) {
        throw new Error('No active cryptocurrency adapter');
      }

      // For multi-crypto mode, we need to implement commit-reveal logic in the adapter
      // For now, we'll use the regular commitShot and handle discounts separately
      const secret = adapter.generateSecret();
      const commitment = adapter.generateCommitment(secret, wallet.address);
      
      // First commit the shot
      const commitResult = await adapter.commitShot(commitment, actualShotCost);
      console.log('✅ Shot committed:', commitResult.hash);
      
      // Wait for reveal delay (this should be handled by the UI in practice)
      toastStore.info('Shot committed! Waiting for reveal window...');
      
      // For now, we'll immediately try to reveal (in production, this should be delayed)
      // TODO: Implement proper reveal timing in UI
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      result = await adapter.revealShot(secret);
    } else {
      // ETH-only mode: direct contract interaction
      if (!contract || !ethers || !wallet.signer) {
        throw new Error('Contract or signer not available');
      }

      result = await executeShotTransaction({
        contract,
        ethers,
        wallet,
        actualShotCost,
        discountApplied
      });
    }
    
    console.log('✅ Shot transaction completed:', result.hash);
    
    if (result.won) {
      toastStore.success('🎉 JACKPOT! You won the pot!');
    } else {
      const message = discountApplied ?
        `Shot taken with ${(discountPercentage * 100).toFixed(0)}% discount! Better luck next time.` :
        'Shot taken! Better luck next time.';
      toastStore.info(message);
    }
    
    if (result.won) {
      // Trigger winner animation
      winnerEventStore.set({
        winner: wallet.address,
        amount: state.currentPot,
        timestamp: new Date().toISOString(),
        isDiscountShot: result.isDiscountShot || false
      });
      
      // Notify all users about the jackpot win
      notifyJackpotWon(state.currentPot, wallet.address);
    }

    // Log transaction to database
    await logShotToDatabase({
      result,
      wallet,
      actualShotCost,
      state,
      discountApplied,
      discountPercentage,
      db
    });

    // Clear cache to force fresh data fetch
    rpcCache.clear();
    
    // Add a small delay to ensure blockchain state is updated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh game state with fresh data
    await loadGameState();
    await loadPlayerData(wallet.address);
    
    // Update wallet balance for all shots (since discounts still cost money)
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
    updateState(state => ({ ...state, error: errorMessage }));
  } finally {
    updateState(state => ({ ...state, takingShot: false }));
  }
};

/**
 * Execute shot transaction for ETH-only mode
 * @param {Object} params - Transaction parameters
 * @returns {Promise<Object>} Transaction result
 */
const executeShotTransaction = async ({ contract, ethers, wallet, actualShotCost, discountApplied }) => {
  const contractWithSigner = contract.connect(wallet.signer);
  const fullShotCost = await contract.SHOT_COST();
  
  // Check if the pot is big enough for a successful shot - MUST happen before gas estimation
  let currentPot;
  try {
    // Get current pot size
    currentPot = await contract.getCurrentPot();
    
    // For debugging
    console.log('🔍 Current pot size check:', {
      potSize: ethers.formatEther(currentPot),
      minRequired: ethers.formatEther(fullShotCost)
    });
  } catch (potReadError) {
    console.error('❌ Failed to read pot size:', potReadError);
    throw new Error('Unable to verify game state. Please try again later.');
  }
  
  // Explicit check with clear error message
  if (currentPot < fullShotCost) {
    console.warn('⚠️ Pot too small for shot - aborting transaction');
    
    // Special case for empty pot (first player)
    if (currentPot === 0n) {
      throw new Error(`You appear to be the first player! To start the game, you need to fund the pot with at least ${ethers.formatEther(fullShotCost)} ETH by taking the first shot. This shot will establish the minimum required pot size.`);
    } else {
      throw new Error(`Pot is currently ${ethers.formatEther(currentPot)} ETH, which is too small for payout precision. The pot needs at least ${ethers.formatEther(fullShotCost)} ETH to function properly.`);
    }
  }

  // Always use full shot cost for the transaction
  // Discounts are handled at the database/UI level, not contract level
  const transactionValue = fullShotCost;

  console.log('🔍 Pre-transaction validation:', {
    contractAddress: await contract.getAddress(),
    shotCost: ethers.formatEther(fullShotCost),
    userAddress: wallet.address
  });
  
  // We'll run a validation check after setting up the signed contract

  // Check if user can commit a shot
  const canCommit = await contract.canCommitShot(wallet.address);
  if (!canCommit) {
    throw new Error('Cannot commit shot. You may be in cooldown period or have a pending shot.');
  }

  // Check if user has pending shot
  const hasPending = await contract.hasPendingShot(wallet.address);
  if (hasPending) {
    throw new Error('You have a pending shot. Please wait for the reveal window or reveal your current shot.');
  }

  // Check user balance
  const balance = await wallet.provider.getBalance(wallet.address);
  console.log('💰 Balance check:', {
    balance: ethers.formatEther(balance),
    required: ethers.formatEther(fullShotCost)
  });
  
  // Generate secret and commitment for commit-reveal
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.keccak256(
    ethers.solidityPacked(['uint256', 'address'], [secret, wallet.address])
  );
  
  // Estimate gas for commitShot
  let gasEstimate;
  try {
    gasEstimate = await contractWithSigner.commitShot.estimateGas(commitment, {
      value: transactionValue
    });
    console.log('✅ Gas estimation successful:', gasEstimate.toString());
  } catch (estimateError) {
    console.error('❌ Gas estimation failed:', estimateError);
    
    // Check if this is a simulation failure
    if (estimateError.message.includes('execution reverted') ||
        estimateError.message.includes('transaction may fail') ||
        estimateError.code === 'UNPREDICTABLE_GAS_LIMIT') {
      throw new Error('Transaction simulation failed. This may be due to insufficient funds, cooldown period, or contract state. Please check your balance and try again.');
    }
    
    console.warn('Using default gas estimate due to estimation failure');
    gasEstimate = 150000n;
  }
  
  const gasLimit = gasEstimate < 120000n ? 150000n : gasEstimate + (gasEstimate * 20n / 100n);
  
  // Get gas price and calculate total cost
  const feeData = await wallet.provider.getFeeData();
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
  const estimatedGasCost = gasLimit * gasPrice;
  const totalCost = transactionValue + estimatedGasCost;
  
  if (balance < totalCost) {
    const shortfall = ethers.formatEther(totalCost - balance);
    throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
  }

  console.log('🎯 Committing shot with:', {
    commitment,
    secret: secret.slice(0, 10) + '...',
    value: ethers.formatEther(transactionValue),
    gasLimit: gasLimit.toString()
  });
  
  // First commit the shot
  const commitTx = await contractWithSigner.commitShot(commitment, {
    value: transactionValue,
    gasLimit: gasLimit
  });
  
  toastStore.info('Shot committed! Waiting for confirmation...');
  const commitReceipt = await commitTx.wait();
  
  // Check if pot was updated after commit
  const potAfterCommit = await contract.getCurrentPot();
  console.log('✅ Commit transaction confirmed:', commitReceipt.hash, {
    potSizeBefore: ethers.formatEther(currentPot),
    potSizeAfterCommit: ethers.formatEther(potAfterCommit),
    shotCost: ethers.formatEther(fullShotCost)
  });
  
  toastStore.info('Commitment confirmed! Waiting for reveal window...');
  
  // Wait for reveal delay (in practice, this should be handled by UI timing)
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
  
  // Check if we can reveal
  const canReveal = await contract.canRevealShot(wallet.address);
  if (!canReveal) {
    throw new Error('Cannot reveal shot yet. Please wait for the reveal window.');
  }
  
  console.log('🔓 Revealing shot with secret:', secret.slice(0, 10) + '...');
  
  // Now reveal the shot
  const revealTx = await contractWithSigner.revealShot(secret);
  toastStore.info('Revealing shot...');

  toastStore.info('Shot submitted! Waiting for confirmation...');
  const receipt = await revealTx.wait();
  
  console.log('✅ Reveal transaction confirmed:', receipt.hash);
  
  // Check if user won by looking at ShotRevealed events
  const shotRevealedEvent = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed.name === 'ShotRevealed';
    } catch {
      return false;
    }
  });

  let won = false;
  if (shotRevealedEvent) {
    const parsed = contract.interface.parseLog(shotRevealedEvent);
    won = parsed.args.won;
    console.log('🎲 Shot result:', won ? 'WON!' : 'Lost');
  }

  return {
    hash: receipt.hash,
    receipt,
    won,
    isDiscountShot: discountApplied
  };
};

/**
 * Log shot transaction to database
 * @param {Object} params - Logging parameters
 */
const logShotToDatabase = async ({
  result,
  wallet,
  actualShotCost,
  state,
  discountApplied,
  discountPercentage,
  db
}) => {
  try {
    console.log('📝 Recording shot to database...');

    // Get contract address from environment or state
    const contractAddress = state.contractAddress || process.env.PUBLIC_CONTRACT_ADDRESS;

    const shotRecord = await db.recordShot({
      playerAddress: wallet.address,
      amount: actualShotCost,
      won: result.won,
      txHash: result.hash,
      blockNumber: result.receipt.blockNumber,
      timestamp: new Date().toISOString(),
      cryptoType: state.activeCrypto,
      contractAddress: contractAddress
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
        cryptoType: state.activeCrypto,
        contractAddress: contractAddress
      });
      console.log('✅ Winner recorded successfully:', winnerRecord?.id);
    }

    // Update player record
    console.log('👤 Updating player record...');
    const existingPlayer = await db.getPlayer(wallet.address);
    
    const newTotalShots = (existingPlayer?.total_shots || 0) + 1;
    const newTotalSpent = parseFloat(existingPlayer?.total_spent || '0') + parseFloat(actualShotCost);
    const newTotalWon = result.won ?
      parseFloat(existingPlayer?.total_won || '0') + parseFloat(state.currentPot) :
      parseFloat(existingPlayer?.total_won || '0');

    const playerData = {
      address: wallet.address,
      totalShots: newTotalShots,
      totalSpent: newTotalSpent.toString(),
      totalWon: newTotalWon.toString(),
      lastShotTime: new Date().toISOString(),
      cryptoType: state.activeCrypto,
      contractAddress: contractAddress
    };

    const playerRecord = await db.upsertPlayer(playerData);
    console.log('✅ Player record updated successfully:', playerRecord?.address);

  } catch (dbError) {
    console.error('❌ Failed to log transaction to database:', dbError);
    toastStore.error('Shot successful but failed to update leaderboard. Please refresh the page.');
  }
};