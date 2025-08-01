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
import { NETWORK_CONFIG } from '../../config.js';
import { shotsAPI } from '../../api/shots.js';
import {
  notifyJackpotWon,
  scheduleCooldownNotification
} from '../../utils/notifications.js';
import { showWinMessage, showLossMessage } from '../shot-result-message.js';
import { safeBigIntToNumber } from './utils.js';

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
          totalShots: safeBigIntToNumber(playerStatsResult[0].totalShots),
          totalSpent: adapter.ethers.formatEther(playerStatsResult[0].totalSpent),
          totalWon: adapter.ethers.formatEther(playerStatsResult[0].totalWon),
          lastShotTime: new Date(safeBigIntToNumber(playerStatsResult[0].lastShotTime) * 1000).toISOString(),
        };
        canShoot = canShootResult[0];
        cooldownRemaining = safeBigIntToNumber(cooldownResult[0]);
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
          totalShots: safeBigIntToNumber(playerStats.totalShots),
          totalSpent: ethers.formatEther(playerStats.totalSpent),
          totalWon: ethers.formatEther(playerStats.totalWon),
          lastShotTime: new Date(safeBigIntToNumber(playerStats.lastShotTime) * 1000).toISOString(),
        };

        cooldownRemaining = safeBigIntToNumber(cooldownRemaining);
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
  customShotCost = null,
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
  console.log('🎯 Player takeShot() called!', { useDiscount, discountId, customShotCost });
  
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
  
  console.log('🎮 Game state:', {
    contractDeployed: state.contractDeployed,
    canShoot: state.canShoot,
    takingShot: state.takingShot,
    activeCrypto: state.activeCrypto
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
      // Multi-crypto mode: use adapter with full commit-reveal cycle
      const adapter = getActiveAdapter();
      if (!adapter) {
        throw new Error('No active cryptocurrency adapter');
      }

      console.log('🎯 Multi-crypto mode: Starting commit-reveal cycle...');
      toastStore.info('🎯 Starting shot transaction...');

      // Generate secret and commitment for commit-reveal
      const secret = adapter.generateSecret();
      const commitment = adapter.generateCommitment(secret, wallet.address);
      
      console.log('🔐 Generated secret and commitment for multi-crypto shot');
      
      // First commit the shot
      console.log('📝 Committing shot to blockchain...');
      toastStore.info('📝 Committing shot to blockchain...');
      
      const commitResult = await adapter.commitShot(commitment, actualShotCost);
      console.log('✅ Shot committed successfully:', commitResult.hash);
      toastStore.success('✅ Shot committed! Waiting for reveal...');
      
      // Wait a moment for the commit to be processed
      console.log('⏳ Waiting 2 seconds for commit to be processed...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Now reveal the shot immediately
      console.log('🔓 Auto-revealing shot...');
      toastStore.info('🔓 Revealing shot result...');
      
      try {
        const revealResult = await adapter.revealShot(secret);
        console.log('✅ Shot revealed successfully:', revealResult.hash);
        toastStore.success('✅ Shot revealed! Processing result...');
        
        result = {
          hash: revealResult.hash,
          receipt: revealResult,
          won: revealResult.won,
          isCommitOnly: false
        };
        
        console.log('🎲 Multi-crypto shot result:', { won: result.won, hash: result.hash });
      } catch (revealError) {
        console.error('❌ Failed to reveal multi-crypto shot:', revealError);
        toastStore.error('❌ Failed to reveal shot: ' + revealError.message);
        throw revealError;
      }
      
      // Clear any existing pending shot state
      updateState(state => ({ ...state, pendingShot: null }));
    } else {
      // ETH-only mode: direct contract interaction with full commit-reveal
      if (!contract || !ethers || !wallet.signer) {
        throw new Error('Contract or signer not available');
      }

      console.log('🎯 ETH-only mode: Starting commit-reveal cycle...');
      toastStore.info('🎯 Starting ETH shot transaction...');

      try {
        result = await executeShotTransaction({
          contract,
          ethers,
          wallet,
          actualShotCost,
          customShotCost,
          discountApplied
        });
        
        console.log('✅ ETH-only shot completed successfully:', result.hash);
        console.log('🎲 ETH-only shot result:', { won: result.won, hash: result.hash });
      } catch (ethError) {
        console.error('❌ Failed to complete ETH-only shot:', ethError);
        toastStore.error('❌ Failed to complete shot: ' + ethError.message);
        throw ethError;
      }
      
      // Clear any existing pending shot state
      updateState(state => ({ ...state, pendingShot: null }));
    }
    
    console.log('✅ Shot transaction completed:', result.hash);
    
    // Handle commit-only transactions (both multi-crypto and ETH-only modes)
    if (result.isCommitOnly) {
      const message = discountApplied ?
        `Shot committed with ${(discountPercentage * 100).toFixed(0)}% discount! Waiting for reveal window...` :
        'Shot committed! Waiting for reveal window...';
      toastStore.info(message);
      
      // Don't log to database yet - wait for reveal
      // Don't trigger winner animations - wait for reveal
      // Still update wallet balance since commit costs money
      await walletStore.updateBalance();
      
      // Refresh game state to show pending shot
      await loadGameState();
      await loadPlayerData(wallet.address);
      
      return; // Exit early for commit-only transactions
    }
    
    // Handle completed reveal transactions
    if (result.won) {
      const ethers = await import('ethers');
      const winAmount = ethers.formatEther(state.currentPot || '0');
      toastStore.success(`🎉 JACKPOT WON! You won ${winAmount} ETH! 🎊`);
      
      // Show prominent page-wide win message
      showWinMessage(winAmount, actualShotCost);
      
      // Also show a more prominent success message
      setTimeout(() => {
        toastStore.success(`💰 Congratulations! ${winAmount} ETH has been sent to your wallet!`);
      }, 2000);
    } else {
      const message = discountApplied ?
        `Shot taken with ${(discountPercentage * 100).toFixed(0)}% discount! Better luck next time.` :
        'Shot taken! Better luck next time.';
      toastStore.info(message);
      
      // Show prominent page-wide loss message
      showLossMessage(actualShotCost);
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
    // For first shots, log the custom cost for display purposes even though we charged full amount
    const loggedShotCost = customShotCost ? customShotCost.toString() : actualShotCost;
    await logShotToDatabase({
      result,
      wallet,
      actualShotCost: loggedShotCost,
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
const executeShotTransaction = async ({ contract, ethers, wallet, actualShotCost, customShotCost, discountApplied }) => {
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
  
  // CRITICAL FIX: The contract's validPotSize modifier prevents first shots
  // because it checks currentPot >= MIN_POT_SIZE BEFORE adding the shot cost
  // For empty pot (first shot), we need to handle this specially
  const isFirstShot = currentPot === 0n;
  
  if (isFirstShot) {
    console.log('🎯 FIRST SHOT DETECTED: Empty pot - will attempt to bypass validPotSize modifier');
    console.log('Note: This may fail due to contract design. Consider pre-funding the pot.');
  } else {
    // For non-empty pots, check if it's big enough for proper payout precision
    if (currentPot < fullShotCost) {
      throw new Error(`Pot is currently ${ethers.formatEther(currentPot)} ETH, which is too small for payout precision. The pot needs at least ${ethers.formatEther(fullShotCost)} ETH to function properly.`);
    }
  }

  // IMPORTANT: Always use full shot cost for contract transactions
  // The contract likely expects exactly SHOT_COST amount and rejects anything else
  // Custom shot costs are handled at the UI/database level for display purposes only
  const transactionValue = fullShotCost;
  
  // Log the decision for debugging
  if (customShotCost) {
    console.log('🔄 CHANGED APPROACH: Using full shot cost instead of custom amount');
    console.log('Reason: Contract likely rejects non-standard amounts');
    console.log('Custom amount will be handled at UI/database level only');
  }
  
  console.log('💰 Transaction value calculation:', {
    customShotCost,
    fullShotCost: ethers.formatEther(fullShotCost),
    transactionValue: ethers.formatEther(transactionValue),
    isFirstShot: !!customShotCost
  });

  console.log('🔍 Pre-transaction validation:', {
    contractAddress: await contract.getAddress(),
    shotCost: ethers.formatEther(fullShotCost),
    userAddress: wallet.address
  });
  
  // We'll run a validation check after setting up the signed contract

  // Check if user can commit a shot
  const canCommit = await contract.canCommitShot(wallet.address);
  const hasPending = await contract.hasPendingShot(wallet.address);
  
  console.log('🔍 Shot validation checks:', {
    canCommit,
    hasPending,
    walletAddress: wallet.address
  });
  
  if (!canCommit) {
    if (hasPending) {
      // Get detailed pending shot info to determine if it's expired
      try {
        const pendingShot = await contract.getPendingShot(wallet.address);
        const currentBlock = await wallet.provider.getBlockNumber();
        const commitBlock = safeBigIntToNumber(pendingShot.blockNumber);
        const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
        
        const revealExpired = currentBlock > commitBlock + maxRevealDelay;
        
        if (revealExpired) {
          throw new Error('You have an expired pending shot. Please refresh the page to clear it and try again.');
        } else {
          // Check if we can reveal the pending shot
          const canReveal = await contract.canRevealShot(wallet.address);
          if (canReveal) {
            throw new Error('You have a pending shot ready to reveal. Please complete the reveal transaction first.');
          } else {
            const blocksToWait = (commitBlock + 1) - currentBlock; // +1 for REVEAL_DELAY
            throw new Error(`You have a pending shot. Please wait ${Math.max(0, blocksToWait)} more block(s) before revealing.`);
          }
        }
      } catch (pendingCheckError) {
        console.warn('Could not check pending shot details:', pendingCheckError.message);
        throw new Error('You have a pending shot that needs to be resolved. Please refresh the page to clear it.');
      }
    } else {
      throw new Error('Cannot take shot. You may be in cooldown period. Please wait and try again.');
    }
  }

  if (hasPending) {
    throw new Error('You have a pending shot. Please wait for the reveal window or reveal your current shot.');
  }

  // Check user balance
  const balance = await wallet.provider.getBalance(wallet.address);
  console.log('💰 Balance check:', {
    balance: ethers.formatEther(balance),
    requiredForFullShot: ethers.formatEther(fullShotCost),
    actualTransactionValue: ethers.formatEther(transactionValue)
  });
  
  // CRITICAL: Check if contract might be rejecting non-standard amounts
  if (customShotCost && transactionValue !== fullShotCost) {
    console.warn('⚠️ POTENTIAL ISSUE: Sending custom amount to contract that might expect exact SHOT_COST');
    console.warn('Contract SHOT_COST:', ethers.formatEther(fullShotCost));
    console.warn('Our transaction value:', ethers.formatEther(transactionValue));
    console.warn('This might be why the transaction is reverting!');
  }
  
  // Generate secret and commitment for commit-reveal
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.keccak256(
    ethers.solidityPacked(['uint256', 'address'], [secret, wallet.address])
  );
  
  // Estimate gas for commitShot
  let gasEstimate;
  try {
    console.log('🔍 Attempting gas estimation with:', {
      commitment,
      value: ethers.formatEther(transactionValue),
      contractAddress: await contract.getAddress()
    });
    
    gasEstimate = await contractWithSigner.commitShot.estimateGas(commitment, {
      value: transactionValue
    });
    console.log('✅ Gas estimation successful:', gasEstimate.toString());
  } catch (estimateError) {
    console.error('❌ Gas estimation failed:', estimateError);
    console.error('Full error details:', {
      message: estimateError.message,
      code: estimateError.code,
      data: estimateError.data,
      reason: estimateError.reason
    });
    
    // Check if this is a simulation failure
    if (estimateError.message.includes('execution reverted') ||
        estimateError.message.includes('transaction may fail') ||
        estimateError.code === 'UNPREDICTABLE_GAS_LIMIT') {
      
      // Try to get more specific error information
      let specificError = 'Transaction simulation failed.';
      if (estimateError.reason) {
        specificError += ` Reason: ${estimateError.reason}`;
      }
      if (estimateError.data) {
        specificError += ` Data: ${estimateError.data}`;
      }
      
      throw new Error(specificError + ' This may be due to insufficient funds, cooldown period, or contract state. Please check your balance and try again.');
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
  
  // Store the pending shot information for later reveal
  const pendingShotData = {
    secret,
    commitment,
    commitHash: commitReceipt.hash,
    commitBlock: safeBigIntToNumber(commitReceipt.blockNumber),
    amount: transactionValue.toString(),
    timestamp: Date.now()
  };
  
  // Update state to show pending shot
  updateState(state => ({
    ...state,
    pendingShot: pendingShotData,
    takingShot: false
  }));
  
  // Store secret in localStorage for persistence
  try {
    const secretKey = `ethshot_secret_${wallet.address}_${commitReceipt.hash.slice(0, 10)}`;
    const secretData = {
      secret,
      txHash: commitReceipt.hash,
      timestamp: Date.now()
    };
    localStorage.setItem(secretKey, JSON.stringify(secretData));
    
    // Also maintain a list of saved secrets for this wallet
    const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
    const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    existingSecrets.push(secretKey);
    localStorage.setItem(savedSecretsKey, JSON.stringify(existingSecrets));
  } catch (storageError) {
    console.warn('Failed to save secret to localStorage:', storageError);
  }
  
  console.log('✅ Shot committed successfully! Pending reveal...');
  toastStore.success('Shot committed! Waiting for reveal window...');
  
  // Return early - let the user reveal manually or use the pending shot manager
  return {
    hash: commitReceipt.hash,
    receipt: commitReceipt,
    won: false,
    isCommitOnly: true,
    pendingShot: pendingShotData
  };
  
  // This code is no longer reached since we return early after commit
  // The reveal will be handled by the pending shot manager or manual reveal
};

/**
 * Reveal a pending shot
 * @param {Object} params - Parameters object
 * @param {string} params.secret - The secret used in the commitment
 * @param {Object} params.state - Current game state
 * @param {Object} params.contract - Contract instance
 * @param {Object} params.ethers - Ethers library
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.db - Database instance
 * @param {Function} params.updateState - State update function
 * @param {Function} params.loadGameState - Function to reload game state
 * @param {Function} params.loadPlayerData - Function to reload player data
 * @param {Object} params.walletStore - Wallet store instance
 */
export const revealShot = async ({
  secret,
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
  console.log('🔓 Player revealShot() called!', { secret: secret?.slice(0, 10) + '...' });
  
  if (!browser) {
    console.log('❌ Not in browser environment');
    toastStore.error('Not available on server');
    return;
  }
  
  if (!wallet.connected || !wallet.address) {
    console.log('❌ Wallet not connected');
    toastStore.error('Please connect your wallet first');
    return;
  }

  try {
    updateState(state => ({ ...state, takingShot: true, error: null }));

    let result;
    
    // Handle multi-crypto mode vs ETH-only mode
    if (state.isMultiCryptoMode) {
      // Multi-crypto mode: use adapter
      const adapter = getActiveAdapter();
      if (!adapter) {
        throw new Error('No active cryptocurrency adapter');
      }

      // Get the secret from pending shot if not provided
      const pendingShot = state.pendingShot;
      const revealSecret = secret || pendingShot?.secret;
      
      if (!revealSecret) {
        throw new Error('No secret available for reveal. Please take a new shot.');
      }

      console.log('🔓 Revealing shot with adapter...');
      toastStore.info('🎲 Revealing shot result...');
      
      // Reveal using adapter
      result = await adapter.revealShot(revealSecret);
      
      // Clear pending shot from state
      updateState(state => ({ ...state, pendingShot: null }));
      
    } else {
      // ETH-only mode: direct contract interaction
      if (!contract || !ethers || !wallet.signer) {
        throw new Error('Contract or signer not available');
      }

      if (!secret) {
        throw new Error('Secret is required to reveal shot');
      }

      const contractWithSigner = contract.connect(wallet.signer);
      
      // Check if user can reveal
      const canReveal = await contract.canRevealShot(wallet.address);
      if (!canReveal) {
        throw new Error('Cannot reveal shot. Either no pending shot exists or reveal window is not open.');
      }

      console.log('🔓 Revealing shot with secret:', secret.slice(0, 10) + '...');
      
      // Reveal the shot
      const revealTx = await contractWithSigner.revealShot(secret);
      toastStore.info('🎲 Revealing shot result...');

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

      result = {
        hash: receipt.hash,
        receipt,
        won
      };
      
      // Clear pending shot from state after successful reveal
      updateState(state => ({ ...state, pendingShot: null }));
    }
    
    // Enhanced, prominent result feedback with multiple notifications
    if (result.won) {
      // Multiple success messages for maximum visibility
      toastStore.success('🎉 JACKPOT! YOU WON! 🎊', { duration: 10000 });
      
      // Show prominent page-wide win message
      const winAmount = state.currentPot || '0';
      const shotCost = pendingShot?.actualShotCost || state.shotCost;
      showWinMessage(winAmount, shotCost);
      
      setTimeout(() => {
        toastStore.success('💰 CONGRATULATIONS! You hit the jackpot! 💰', { duration: 8000 });
      }, 1000);
      setTimeout(() => {
        toastStore.success('🏆 WINNER! Check your wallet for the payout! 🏆', { duration: 6000 });
      }, 3000);
    } else {
      // Clear loss indication with enhanced messaging
      toastStore.info('🎲 Shot revealed - No win this time. Better luck next shot!', { duration: 6000 });
      
      // Show prominent page-wide loss message
      const shotCost = pendingShot?.actualShotCost || state.shotCost;
      showLossMessage(shotCost);
      
      setTimeout(() => {
        toastStore.info('💪 Keep trying! The next shot could be the winner!', { duration: 4000 });
      }, 2000);
    }

    if (result.won) {
      // Trigger winner animation
      winnerEventStore.set({
        winner: wallet.address,
        amount: state.currentPot,
        timestamp: new Date().toISOString(),
        isDiscountShot: state.pendingShot?.discountApplied || false
      });
      
      // Notify all users about the jackpot win
      notifyJackpotWon(state.currentPot, wallet.address);
    }

    // Log transaction to database with pending shot details
    const pendingShot = state.pendingShot;
    await logShotToDatabase({
      result,
      wallet,
      actualShotCost: pendingShot?.actualShotCost || state.shotCost,
      state,
      discountApplied: pendingShot?.discountApplied || false,
      discountPercentage: pendingShot?.discountPercentage || 0,
      db
    });

    // Clear cache to force fresh data fetch
    rpcCache.clear();
    
    // Add a small delay to ensure blockchain state is updated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh game state with fresh data
    await loadGameState();
    await loadPlayerData(wallet.address);
    
    // Update wallet balance
    await walletStore.updateBalance();

    return result;

  } catch (error) {
    console.error('Failed to reveal shot:', error);
    
    let errorMessage = 'Failed to reveal shot';
    if (error.message.includes('insufficient funds')) {
      errorMessage = `Insufficient ${state.activeCrypto} balance for gas`;
    } else if (error.message.includes('user rejected')) {
      errorMessage = 'Transaction cancelled';
    } else if (error.message.includes('reveal')) {
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
 * Log shot transaction to database via local API with proper JWT authentication
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
    console.log('📝 Recording shot via local API...');

    // Get contract address from centralized config or state
    const contractAddress = state.contractAddress || NETWORK_CONFIG.CONTRACT_ADDRESS;

    console.log('🔐 Recording shot via shots API...');
    const shotRecord = await shotsAPI.recordShot({
      playerAddress: wallet.address,
      amount: actualShotCost,
      won: result.won,
      txHash: result.hash,
      blockNumber: safeBigIntToNumber(result.receipt.blockNumber),
      timestamp: new Date().toISOString(),
      cryptoType: state.activeCrypto,
      contractAddress: contractAddress
    });

    console.log('✅ Shot recorded successfully via API:', shotRecord?.id);

    if (result.won) {
      console.log('🏆 Recording winner via shots API...');
      const winnerRecord = await shotsAPI.recordWinner({
        winnerAddress: wallet.address,
        amount: state.currentPot,
        txHash: result.hash,
        blockNumber: safeBigIntToNumber(result.receipt.blockNumber),
        timestamp: new Date().toISOString(),
        cryptoType: state.activeCrypto,
        contractAddress: contractAddress
      });
      console.log('✅ Winner recorded successfully via API:', winnerRecord?.id);
    }

    // Player stats are now automatically updated by the database trigger
    console.log('✅ Player stats will be updated automatically by database trigger');

  } catch (apiError) {
    console.error('❌ Failed to log transaction via API:', apiError);
    
    // Provide specific error messages based on the error type
    if (apiError.message?.includes('Authentication required') || apiError.message?.includes('authentication')) {
      toastStore.error('Authentication expired. Shot successful but not recorded. Please reconnect your wallet.');
    } else if (apiError.message?.includes('Access denied') || apiError.message?.includes('policy')) {
      toastStore.error('Database access denied. Please ensure you are properly authenticated.');
    } else {
      toastStore.error('Shot successful but failed to update database. Please refresh the page.');
    }
    
    // Don't throw the error - the shot was successful even if database recording failed
    console.log('🎯 Shot transaction was successful despite database recording failure');
  }
};