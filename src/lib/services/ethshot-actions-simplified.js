/**
 * Simplified Game Actions Service
 * 
 * Simplified business logic functions for game operations
 * This removes all pending shot complexity and implements a streamlined flow:
 * - First shot: Commit only (no reveal needed since it can't win)
 * - Subsequent shots: Commit then automatically reveal
 * - Simple spinner during blockchain operations
 */
import { get } from 'svelte/store';
import { getActiveAdapter } from '../crypto/adapters/index.js';
import { toastStore } from '../stores/toast.js';
import { db } from '../database/index.js';
import { supabase } from '../database/client.js';
import { rpcCache } from '../stores/game/cache.js';
import { GAME_CONFIG } from '../config.js';

/**
 * Take a shot in the game (simplified flow)
 * @param {Object} params - Parameters object
 * @param {boolean} params.useDiscount - Whether to use a discount
 * @param {string} params.discountId - Discount ID to use
 * @param {string} params.customShotCost - Custom shot cost
 * @param {Object} params.gameState - Current game state
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Function} params.updateGameState - Function to update game state
 * @param {Function} params.loadGameState - Function to reload game state
 * @param {Function} params.loadPlayerData - Function to reload player data
 * @returns {Promise<Object>} Transaction result
 */
export const takeShot = async ({
  useDiscount = false,
  discountId = null,
  customShotCost = null,
  gameState,
  wallet,
  contract,
  ethers,
  updateGameState,
  loadGameState,
  loadPlayerData,
  onStatusUpdate = null // New callback for status updates
}) => {
  const updateStatus = (status, message) => {
    console.log(`🔄 [takeShot] Status: ${status} - ${message}`);
    if (typeof onStatusUpdate === 'function') {
      try {
        onStatusUpdate(status, message);
      } catch (e) {
        console.error('❌ [takeShot] onStatusUpdate callback error:', e);
      }
    } else if (onStatusUpdate) {
      console.warn('⚠️ [takeShot] onStatusUpdate provided but is not a function:', typeof onStatusUpdate);
    }
  };

  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (gameState.contractDeployed === false) {
    throw new Error(`${gameState.activeCrypto} contract not deployed yet.`);
  }

  if (!gameState.canShoot) {
    throw new Error('Cannot take shot at this time');
  }

  if (gameState.takingShot) {
    throw new Error('Shot already in progress');
  }

  let result;

  if (gameState.isMultiCryptoMode) {
    // Multi-crypto mode: use adapter
    const adapter = getActiveAdapter();
    if (!adapter) {
      throw new Error('No active cryptocurrency adapter');
    }

    result = await adapter.takeShot(useDiscount, discountId, customShotCost);
  } else {
    // ETH-only mode: direct contract interaction
    if (!contract || !ethers || !wallet.signer) {
      throw new Error('Contract or signer not available');
    }

    updateStatus('preparing', 'Preparing transaction...');
    
    const contractWithSigner = contract.connect(wallet.signer);
    const shotCost = await contract.SHOT_COST();

    // Determine first-shot parameters and amount
    const customCostWei = customShotCost ? ethers.parseEther(customShotCost) : null;
    const isFirstShot = !!customShotCost && parseFloat(customShotCost) === parseFloat(GAME_CONFIG.FIRST_SHOT_COST_ETH);
    const firstShotValue = isFirstShot ? (customCostWei || shotCost) : shotCost;

    updateStatus('checking_balance', 'Checking wallet balance...');
    
    // Check user balance
    const balance = await wallet.provider.getBalance(wallet.address);
    
    updateStatus('estimating_gas', 'Estimating gas costs...');
    
    // Estimate gas with proper commitment hash
    let gasEstimate;
    try {
      console.log('🔧 [takeShot] Starting gas estimation...');
      // Generate a proper commitment for gas estimation (include sender for parity)
      const tempSecret = 123456n;
      const tempCommitment = ethers.keccak256(
        ethers.solidityPacked(['uint256', 'address'], [tempSecret, wallet.address])
      );
      console.log('🔧 [takeShot] Generated temp commitment for gas estimation (with sender):', tempCommitment);
      
      // Choose the appropriate function for gas estimation
      if (isFirstShot) {
        console.log('🔧 [takeShot] Estimating gas for commitFirstShot...');
        
        if (contractWithSigner.estimateGas && contractWithSigner.estimateGas.commitFirstShot) {
          gasEstimate = await contractWithSigner.estimateGas.commitFirstShot(tempCommitment, {
            value: firstShotValue
          });
        } else if (contractWithSigner.commitFirstShot && contractWithSigner.commitFirstShot.estimateGas) {
          gasEstimate = await contractWithSigner.commitFirstShot.estimateGas(tempCommitment, {
            value: firstShotValue
          });
        } else {
          throw new Error('commitFirstShot gas estimation not available on contract');
        }
      } else {
        console.log('🔧 [takeShot] Estimating gas for commitShot...');
        
        if (contractWithSigner.estimateGas && contractWithSigner.estimateGas.commitShot) {
          gasEstimate = await contractWithSigner.estimateGas.commitShot(tempCommitment, {
            value: shotCost
          });
        } else if (contractWithSigner.commitShot && contractWithSigner.commitShot.estimateGas) {
          gasEstimate = await contractWithSigner.commitShot.estimateGas(tempCommitment, {
            value: shotCost
          });
        } else {
          throw new Error('commitShot gas estimation not available on contract');
        }
      }
      console.log('✅ [takeShot] Gas estimation successful:', gasEstimate.toString());
    } catch (estimateError) {
      console.error('❌ [takeShot] Failed to estimate gas:', estimateError);
      console.warn('⚠️ [takeShot] Using default gas estimate');
      gasEstimate = 100000n;
    }
    
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
    
    // Get gas price and calculate total cost
    const feeData = await wallet.provider.getFeeData();
    let gasPrice;
    
    // Handle different fee structures (EIP-1559 vs legacy)
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      gasPrice = feeData.maxFeePerGas;
    } else if (feeData.gasPrice) {
      // Legacy transaction
      gasPrice = feeData.gasPrice;
    } else {
      // Fallback to a reasonable gas price (20 gwei)
      gasPrice = ethers.parseUnits('20', 'gwei');
    }

    // Build explicit fee overrides to cap wallet's worst-case calculation
    const txOverrides = { gasLimit };
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      txOverrides.maxFeePerGas = feeData.maxFeePerGas;
      txOverrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else {
      txOverrides.gasPrice = gasPrice;
    }
    
    // Use BigInt for all cost math to avoid BigInt/number mixing errors
    const estimatedGasCost = gasLimit * gasPrice;
    const totalCost = firstShotValue + estimatedGasCost;
    const buffer = estimatedGasCost / 5n; // 20% safety buffer for wallet warnings
    const balanceCheckCost = totalCost + buffer;
    
    console.log('Gas estimation details:', {
      shotCost: ethers.formatEther(shotCost),
      firstShotValue: ethers.formatEther(firstShotValue),
      customShotCost: customShotCost || 'none',
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      estimatedGasCost: ethers.formatEther(estimatedGasCost),
      totalCost: ethers.formatEther(totalCost),
      balanceCheckCost: ethers.formatEther(balanceCheckCost),
      balance: ethers.formatEther(balance)
    });
    
    if (balance < balanceCheckCost) {
      const shortfall = ethers.formatEther(balanceCheckCost - balance);
      throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
    }

    updateStatus('generating_commitment', 'Generating secure commitment...');

    // Generate commitment - CRITICAL FIX: Must match contract's expectation
    console.log('🔧 [takeShot] Generating secret and commitment...');
    const secret = ethers.hexlify(ethers.randomBytes(32));
    console.log('🔧 [takeShot] Generated secret:', secret);
    
    // IMPORTANT: Contract expects uint256 secret, not bytes32
    // Convert hex string to BigInt for proper encoding
    const secretBigInt = BigInt(secret);
    console.log('🔧 [takeShot] Secret as BigInt:', secretBigInt.toString());
    
    // Contract expects: keccak256(abi.encodePacked(secret, msg.sender))
    const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secretBigInt, wallet.address]));
    console.log('🔧 [takeShot] Generated commitment:', commitment);
    
    // Validate commitment is not zero
    if (commitment === ethers.ZeroHash) {
      throw new Error('Generated invalid commitment (zero hash)');
    }

    updateStatus('pre_flight_check', 'Performing pre-flight validation...');
    
    // Pre-flight validation checks
    try {
      console.log('🔧 [takeShot] Running comprehensive pre-flight checks...');
      
      // Check 1: Contract not paused
      try {
        const isPaused = await contract.paused();
        console.log('🔧 [takeShot] Contract paused:', isPaused);
        if (isPaused) {
          throw new Error('Contract is currently paused. Please try again later.');
        }
      } catch (pauseError) {
        console.warn('⚠️ [takeShot] Could not check pause status:', pauseError.message);
        // Continue - some contracts might not have paused() function
      }
      
      // Check 2: Player can commit shot
      const canCommit = await contract.canCommitShot(wallet.address);
      console.log('🔧 [takeShot] Can commit shot:', canCommit);
      
      if (!canCommit) {
        // Get more specific information about why they can't commit
        const cooldownRemaining = await contract.getCooldownRemaining(wallet.address);
        const hasPending = await contract.hasPendingShot(wallet.address);
        
        console.log('🔧 [takeShot] Cooldown remaining:', cooldownRemaining.toString(), 'seconds');
        console.log('🔧 [takeShot] Has pending shot:', hasPending);
        
        if (cooldownRemaining > 0) {
          throw new Error(`Cooldown period not elapsed. Please wait ${cooldownRemaining} more seconds.`);
        }
        
        if (hasPending) {
          throw new Error('You have a pending shot that needs to be revealed first.');
        }
        
        throw new Error('Cannot commit shot at this time. Please check contract conditions.');
      }
      
      // Check 3: Verify the commitment is not zero
      if (commitment === ethers.ZeroHash) {
        throw new Error('Invalid commitment generated');
      }
      
      // Check 4: Verify wallet is EOA (not a contract)
      // This is critical because the contract requires tx.origin == msg.sender
      try {
        const code = await wallet.provider.getCode(wallet.address);
        if (code !== '0x') {
          console.warn('⚠️ [takeShot] Wallet appears to be a smart contract. This may cause transaction to revert due to EOA requirement.');
          // Don't throw here, but warn the user
        } else {
          console.log('✅ [takeShot] Wallet is EOA (externally owned account)');
        }
      } catch (codeError) {
        console.warn('⚠️ [takeShot] Could not verify wallet type:', codeError.message);
      }
      
      // Check 5: Verify payment amount and handle first shot logic
      console.log('🔧 [takeShot] Payment validation:', {
        shotCostFromContract: ethers.formatEther(shotCost),
        customCost: customShotCost || 'none',
        isFirstShot: isFirstShot,
        firstShotCostConfig: GAME_CONFIG.FIRST_SHOT_COST_ETH
      });
      
      // CRITICAL: Contract always requires exactly SHOT_COST payment
      // For first shots, we send SHOT_COST to contract but track the higher amount for UI/database
      if (customCostWei && customCostWei !== shotCost) {
        if (isFirstShot) {
          console.log('🔧 [takeShot] First shot detected - will send contract SHOT_COST but track higher amount');
          console.log('🔧 [takeShot] Contract payment:', ethers.formatEther(shotCost), 'ETH');
          console.log('🔧 [takeShot] UI/Database amount:', customShotCost, 'ETH');
        } else {
          console.warn('⚠️ [takeShot] Custom shot cost differs from contract SHOT_COST');
          console.warn('⚠️ [takeShot] Contract expects exactly:', ethers.formatEther(shotCost), 'ETH');
          console.warn('⚠️ [takeShot] Custom cost provided:', ethers.formatEther(customCostWei), 'ETH');
          console.warn('⚠️ [takeShot] Overriding to match contract requirement');
        }
      }
      
      console.log('✅ [takeShot] Pre-flight checks passed');
    } catch (preFlightError) {
      console.error('❌ [takeShot] Pre-flight check failed:', preFlightError);
      throw preFlightError;
    }

    updateStatus('sending_transaction', 'Sending transaction to blockchain...');

    // Choose the appropriate function and payment amount based on shot type
    let tx;
    try {
      if (isFirstShot) {
        // Use commitFirstShot for first shots with configurable amount
        const firstShotValue = customCostWei || shotCost;
        console.log('🔧 [takeShot] Sending commitFirstShot transaction with:', {
          commitment,
          value: ethers.formatEther(firstShotValue),
          gasLimit: gasLimit.toString(),
          isFirstShot: true,
          customShotCost: customShotCost || 'none'
        });
        
        tx = await contractWithSigner.commitFirstShot(commitment, {
          value: firstShotValue,
          ...txOverrides
        });
        console.log('✅ [takeShot] First shot transaction sent, hash:', tx.hash);
      } else {
        // Use regular commitShot for subsequent shots
        console.log('🔧 [takeShot] Sending commitShot transaction with:', {
          commitment,
          value: ethers.formatEther(shotCost),
          gasLimit: gasLimit.toString(),
          isFirstShot: false,
          customShotCost: customShotCost || 'none'
        });
        
        tx = await contractWithSigner.commitShot(commitment, {
          value: shotCost,
          ...txOverrides
        });
        console.log('✅ [takeShot] Regular shot transaction sent, hash:', tx.hash);
      }
    } catch (sendError) {
      console.error('❌ [takeShot] Failed to send commitShot transaction:', sendError);
      
      // Check for specific revert reasons
      if (sendError.code === 'CALL_EXCEPTION') {
        // Try to get more specific error information
        let errorMessage = 'Transaction would revert';
        
        if (sendError.reason) {
          errorMessage = `Contract rejected transaction: ${sendError.reason}`;
        } else if (sendError.data) {
          errorMessage = `Contract rejected transaction with data: ${sendError.data}`;
        }
        
        throw new Error(errorMessage);
      }
      
      throw sendError;
    }

    updateStatus('waiting_confirmation', 'Waiting for blockchain confirmation...');

    let receipt;
    try {
      receipt = await tx.wait();
      console.log('✅ [takeShot] Transaction confirmed:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber
      });
      
      // Check if transaction was successful
      if (receipt.status !== 1) {
        throw new Error('Transaction reverted during execution');
      }
    } catch (waitError) {
      console.error('❌ [takeShot] Transaction failed during confirmation:', waitError);
      
      if (waitError.code === 'CALL_EXCEPTION' && waitError.receipt?.status === 0) {
        // Transaction was mined but reverted
        throw new Error('Transaction was mined but reverted. This could be due to: insufficient balance, cooldown not elapsed, or contract validation failure.');
      }
      
      throw waitError;
    }
    
    updateStatus('processing', 'Processing transaction result...');
    
    if (isFirstShot) {
      // First shot: no secret storage, no reveal needed - just adds to pot
      const actualFirstShotAmount = customCostWei || shotCost;
      const actualFirstShotAmountEth = ethers.formatEther(actualFirstShotAmount);
      
      console.log('🚀 First shot detected - no secret storage or reveal needed');
      console.log('🚀 Contract received:', actualFirstShotAmountEth, 'ETH');
      console.log('🚀 UI shows:', customShotCost || actualFirstShotAmountEth, 'ETH');
      
      result = {
        hash: receipt.hash,
        receipt,
        isCommitOnly: true,
        isFirstShot: true,
        won: false, // First shots can't win
        displayAmount: customShotCost || actualFirstShotAmountEth, // Amount to show in UI
        contractAmount: actualFirstShotAmountEth, // Amount actually sent to contract
        actualAmount: actualFirstShotAmountEth // The real amount paid
      };
      
      // Log first shot to database with the actual amount paid
      try {
        await db.recordShot({
          playerAddress: wallet.address,
          amount: customShotCost || actualFirstShotAmountEth, // Use the actual amount paid
          txHash: result?.hash || null,
          blockNumber: result?.receipt?.blockNumber || null,
          timestamp: new Date().toISOString(),
          won: false, // First shots can't win
          cryptoType: gameState.activeCrypto,
          contractAddress: gameState.contractAddress
        });
        console.log('✅ First shot recorded in database with actual amount:', customShotCost || actualFirstShotAmountEth);
      } catch (dbError) {
        console.error('Failed to log first shot to database:', dbError);
        // Don't throw here - the shot was successful even if logging failed
      }
      
      // Update game state for first shot
      updateGameState({
        totalShots: gameState.totalShots + 1,
        lastShotTime: new Date().toISOString(),
        canShoot: false,
        cooldownUntil: new Date(Date.now() + (parseInt(GAME_CONFIG.COOLDOWN_PERIOD) || 60000)).toISOString()
      });
      
      // Load updated player data
      await loadPlayerData();
      
    } else {
      // Regular shot: store secret for later reveal and automatically reveal
      const pendingShotData = {
        secret,
        commitment,
        commitHash: receipt.hash,
        commitBlock: receipt.blockNumber,
        amount: shotCost.toString(),
        timestamp: Date.now()
      };
      
      result = {
        hash: receipt.hash,
        receipt,
        secret,
        isCommitOnly: true,
        pendingShot: pendingShotData
      };
      
      // Store secret in localStorage for persistence and recovery
      try {
        const secretKey = `ethshot_secret_${wallet.address}_${receipt.hash.slice(0, 10)}`;
        const secretData = {
          secret,
          txHash: receipt.hash,
          timestamp: Date.now(),
          isFirstShot: false // Mark as regular shot
        };
        localStorage.setItem(secretKey, JSON.stringify(secretData));
        
        // Also maintain a list of saved secrets for this wallet
        const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
        const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
        existingSecrets.push(secretKey);
        localStorage.setItem(savedSecretsKey, JSON.stringify(existingSecrets));
        
        console.log('✅ Secret stored in localStorage for recovery:', secretKey);
      } catch (storageError) {
        console.warn('Failed to save secret to localStorage:', storageError);
        // Don't throw here - the shot was successful even if storage failed
      }
      
      // Log regular shot to database
      try {
        await db.recordShot({
          playerAddress: wallet.address,
          amount: customShotCost ? customShotCost : ethers.formatEther(shotCost),
          txHash: result?.hash || null,
          blockNumber: result?.receipt?.blockNumber || null,
          timestamp: new Date().toISOString(),
          won: false, // Will be updated when revealed
          cryptoType: gameState.activeCrypto,
          contractAddress: gameState.contractAddress
        });
        console.log('✅ Regular shot recorded in database');
      } catch (dbError) {
        console.error('Failed to log regular shot to database:', dbError);
        // Don't throw here - the shot was successful even if logging failed
      }
      
      // Automatically reveal the shot after a short delay
      updateStatus('auto_revealing', 'Automatically revealing shot...');
      
      // Wait a moment for blockchain state to update
      console.log('🔧 [takeShot] Waiting 2 seconds before auto-reveal...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        console.log('🔧 [takeShot] Starting auto-reveal with secret:', secret);
        const revealResult = await revealShot({
          secret,
          gameState,
          wallet,
          contract,
          ethers,
          loadGameState,
          loadPlayerData,
          onStatusUpdate
        });
        console.log('✅ [takeShot] Auto-reveal completed:', revealResult);
        
        // Update result with reveal information
        result.revealResult = revealResult;
        result.won = revealResult.won;
      } catch (revealError) {
        console.error('❌ [takeShot] Auto-reveal failed:', revealError);
        console.error('❌ [takeShot] Auto-reveal error stack:', revealError.stack);
        
        // Don't throw the error - instead provide a helpful message
        // The secret is already stored in localStorage for manual recovery
        toastStore.info('Shot committed but auto-reveal failed. Your secret is saved for manual reveal if needed.');
        
        // Return the result without reveal information for the UI to handle
        result.revealResult = {
          hash: null,
          receipt: null,
          won: false,
          autoRevealFailed: true,
          error: revealError.message
        };
        result.won = false;
      }
    }

    // Update game state for all shots (first and regular)
    updateGameState({
      totalShots: gameState.totalShots + 1,
      lastShotTime: new Date().toISOString(),
      canShoot: false,
      cooldownUntil: new Date(Date.now() + (parseInt(GAME_CONFIG.COOLDOWN_PERIOD) || 60000)).toISOString()
    });

    updateStatus('refreshing_state', 'Refreshing game state...');

    // Clear cache and refresh state
    rpcCache.clear();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await loadGameState();
    await loadPlayerData(wallet.address);

    updateStatus('completed', 'Shot completed successfully!');
  }

  // For multi-crypto mode, refresh state after adapter call
  updateStatus('refreshing_state', 'Refreshing game state...');

  // Clear cache and refresh state
  rpcCache.clear();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await loadGameState();
  await loadPlayerData(wallet.address);

  updateStatus('completed', 'Shot completed successfully!');

  return result;
};

/**
 * Sponsor a round
 * @param {Object} params - Parameters object
 * @param {string} params.name - Sponsor name
 * @param {string} params.logoUrl - Sponsor logo URL
 * @param {string} params.sponsorUrl - Sponsor website URL
 * @param {Object} params.gameState - Current game state
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Function} params.loadGameState - Function to reload game state
 * @returns {Promise<Object>} Transaction result
 */
export const sponsorRound = async ({
  name,
  logoUrl,
  sponsorUrl = null,
  gameState,
  wallet,
  contract,
  ethers,
  loadGameState
}) => {
  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (gameState.contractDeployed === false) {
    throw new Error(`${gameState.activeCrypto} contract not deployed yet.`);
  }

  if (!name || !logoUrl) {
    throw new Error('Please provide sponsor name and logo URL');
  }

  let result;
  let sponsorAmountWei = null;

  if (gameState.isMultiCryptoMode) {
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
    sponsorAmountWei = sponsorCost;

    // Check user balance
    const balance = await wallet.provider.getBalance(wallet.address);
    
    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.estimateGas.sponsorRound(name, logoUrl, {
        value: sponsorCost
      });
    } catch (estimateError) {
      console.warn('Failed to estimate gas, using default:', estimateError.message);
      gasEstimate = 100000n;
    }
    
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
    
    // Get gas price and calculate total cost
    const feeData = await wallet.provider.getFeeData();
    let gasPrice;
    
    // Handle different fee structures (EIP-1559 vs legacy)
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      gasPrice = feeData.maxFeePerGas;
    } else if (feeData.gasPrice) {
      // Legacy transaction
      gasPrice = feeData.gasPrice;
    } else {
      // Fallback to a reasonable gas price (20 gwei)
      gasPrice = ethers.parseUnits('20', 'gwei');
    }
    
    const estimatedGasCost = Number(gasLimit) * Number(gasPrice);
    const totalCost = Number(sponsorCost) + Number(estimatedGasCost);
    
    console.log('Sponsor gas estimation details:', {
      sponsorCost: ethers.formatEther(sponsorCost),
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      estimatedGasCost: ethers.formatEther(estimatedGasCost),
      totalCost: ethers.formatEther(totalCost),
      balance: ethers.formatEther(balance)
    });
    
    if (balance < totalCost) {
      const shortfall = ethers.formatEther(totalCost - balance);
      throw new Error(`Insufficient ETH. Need ${shortfall} more ETH for gas fees.`);
    }

    const tx = await contractWithSigner.sponsorRound(name, logoUrl, {
      value: sponsorCost,
      gasLimit: gasLimit
    });

    const receipt = await tx.wait();
    
    result = {
      hash: receipt.hash,
      receipt
    };
  }
  
  // Log sponsorship to database
  try {
    await db.recordSponsor({
      sponsorAddress: wallet.address,
      name,
      logoUrl,
      sponsorUrl,
      amount: sponsorAmountWei !== null ? ethers.formatEther(sponsorAmountWei) : null,
      txHash: result?.hash || null,
      blockNumber: result?.receipt?.blockNumber || null,
      timestamp: new Date().toISOString(),
      active: true,
      cryptoType: gameState.activeCrypto
    });
  } catch (dbError) {
    console.error('Failed to log sponsorship to database:', dbError);
  }
  
  // Clear cache and refresh state
  rpcCache.clear();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await loadGameState();

  return result;
};

/**
 * Clear a pending shot using the stored secret (for recovery from failed auto-reveal)
 * @param {Object} params - Parameters object
 * @param {string} params.playerAddress - Player address
 * @param {string} params.commitTxHash - Commit transaction hash
 * @param {Object} params.gameState - Current game state
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Function} params.loadGameState - Function to reload game state
 * @returns {Promise<Object>} Transaction result
 */
export const clearPendingShot = async ({
  playerAddress,
  commitTxHash,
  gameState,
  wallet,
  contract,
  ethers,
  loadGameState
}) => {
  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (gameState.contractDeployed === false) {
    throw new Error(`${gameState.activeCrypto} contract not deployed yet.`);
  }

  if (playerAddress !== wallet.address) {
    throw new Error('You can only clear your own pending shots');
  }

  // Find the secret from localStorage
  let secret = null;
  const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
  const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
  
  for (const secretKey of existingSecrets) {
    try {
      const secretData = JSON.parse(localStorage.getItem(secretKey) || '{}');
      if (secretData.txHash === commitTxHash) {
        secret = secretData.secret;
        break;
      }
    } catch (e) {
      console.warn('Failed to parse secret data:', e);
    }
  }

  if (!secret) {
    throw new Error('No secret found for the specified transaction. The shot may have already been revealed or the data may be corrupted.');
  }

  console.log('🔧 Found secret for clearing pending shot:', commitTxHash);

  if (gameState.isMultiCryptoMode) {
    // Multi-crypto mode: not implemented yet
    throw new Error('Clear pending shot functionality not yet implemented for multi-crypto mode.');
  } else {
    // ETH-only mode: call the reveal function to clear the pending shot
    if (!contract || !ethers || !wallet.signer) {
      throw new Error('Contract or signer not available');
    }

    // Check if user actually has a pending shot
    const hasPending = await contract.hasPendingShot(wallet.address);
    if (!hasPending) {
      console.log('No pending shot found - may have already been cleared');
      return {
        hash: null,
        receipt: null,
        cleared: true,
        message: 'No pending shot found - may have already been cleared'
      };
    }

    const contractWithSigner = contract.connect(wallet.signer);
    
    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.estimateGas.revealShot(secret);
    } catch (estimateError) {
      console.warn('Failed to estimate gas for clear, using default:', estimateError.message);
      gasEstimate = 100000n;
    }
    
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
    
    const tx = await contractWithSigner.revealShot(secret, {
      gasLimit: gasLimit
    });

    const receipt = await tx.wait();
    
    return {
      hash: receipt.hash,
      receipt,
      cleared: true
    };
  }
};

/**
 * Reveal a shot (simplified)
 * @param {Object} params - Parameters object
 * @param {string} params.secret - Secret used when committing the shot
 * @param {Object} params.gameState - Current game state
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @param {Function} params.loadGameState - Function to reload game state
 * @param {Function} params.loadPlayerData - Function to reload player data
 * @returns {Promise<Object>} Transaction result
 */
export const revealShot = async ({
  secret,
  gameState,
  wallet,
  contract,
  ethers,
  loadGameState,
  loadPlayerData,
  onStatusUpdate = null // New callback for status updates
}) => {
  const updateStatus = (status, message) => {
    console.log(`🔄 [revealShot] Status: ${status} - ${message}`);
    if (typeof onStatusUpdate === 'function') {
      try {
        onStatusUpdate(status, message);
      } catch (e) {
        console.error('❌ [revealShot] onStatusUpdate callback error:', e);
      }
    } else if (onStatusUpdate) {
      console.warn('⚠️ [revealShot] onStatusUpdate provided but is not a function:', typeof onStatusUpdate);
    }
  };
  updateStatus('preparing_reveal', 'Preparing to reveal shot...');

  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (gameState.contractDeployed === false) {
    throw new Error(`${gameState.activeCrypto} contract not deployed yet.`);
  }

  if (!secret) {
    throw new Error('Secret is required to reveal the shot');
  }

  let result;

  if (gameState.isMultiCryptoMode) {
    // Multi-crypto mode: use adapter pattern
    throw new Error('Reveal shot functionality not yet implemented for multi-crypto mode.');
  } else {
    // ETH-only mode: direct contract interaction
    if (!contract || !ethers || !wallet.signer) {
      throw new Error('Contract or signer not available');
    }

    updateStatus('checking_pending', 'Checking for pending shot...');

    // Check if user has a pending shot
    const hasPending = await contract.hasPendingShot(wallet.address);
    if (!hasPending) {
      // No pending shot found - this is normal for auto-reveal
      console.log('No pending shot found - this is expected for auto-reveal');
      return {
        hash: null,
        receipt: null,
        won: false,
        noPendingShot: true
      };
    }

    updateStatus('estimating_reveal_gas', 'Estimating gas for reveal...');

    const contractWithSigner = contract.connect(wallet.signer);
    
    // Check wallet balance first
    const balance = await wallet.provider.getBalance(wallet.address);
    
    // Estimate gas with more conservative approach (ethers v6)
    let gasEstimate;
    try {
      console.log('🔧 [revealShot] Starting gas estimation for reveal...');
      console.log('🔧 [revealShot] Secret for estimation:', secret);
      gasEstimate = await contractWithSigner.estimateGas.revealShot(secret);
      console.log('✅ [revealShot] Gas estimate successful:', gasEstimate.toString());
    } catch (estimateError) {
      console.error('❌ [revealShot] Failed to estimate gas for reveal:', estimateError);
      console.error('❌ [revealShot] Gas estimation error stack:', estimateError.stack);
      console.warn('⚠️ [revealShot] Using conservative default gas limit');
      // Use a more conservative default gas limit
      gasEstimate = 150000n; // Increased from 100000n to 150000n
    }
    
    // Use more conservative gas limit calculation
    const gasLimit = gasEstimate < 100000n ? 150000n : gasEstimate + (gasEstimate * 30n / 100n); // 30% buffer
    
    // Get gas price and calculate total cost
    const feeData = await wallet.provider.getFeeData();
    let gasPrice;
    
    // Handle different fee structures (EIP-1559 vs legacy)
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      gasPrice = feeData.maxFeePerGas;
    } else if (feeData.gasPrice) {
      // Legacy transaction
      gasPrice = feeData.gasPrice;
    } else {
      // Fallback to a reasonable gas price (20 gwei)
      gasPrice = ethers.parseUnits('20', 'gwei');
    }
    
    const estimatedGasCost = Number(gasLimit) * Number(gasPrice);
    
    console.log('Reveal gas estimation details:', {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      estimatedGasCost: ethers.formatEther(estimatedGasCost),
      balance: ethers.formatEther(balance)
    });
    
    // Check if user has enough ETH for gas fees (require at least the estimated gas cost)
    const minRequiredBalance = estimatedGasCost;
    
    if (balance < minRequiredBalance) {
      const shortfall = ethers.formatEther(minRequiredBalance - balance);
      throw new Error(`Insufficient ETH for gas fees. Need ${shortfall} more ETH. Current balance: ${ethers.formatEther(balance)} ETH`);
    }
    
    updateStatus('sending_reveal', 'Sending reveal transaction...');

    // Use more conservative gas parameters to avoid reverts
    const finalGasLimit = gasLimit + (gasLimit * 30n / 100n); // 30% buffer
    const txOverrides = { gasLimit: finalGasLimit };
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      txOverrides.maxFeePerGas = feeData.maxFeePerGas;
      txOverrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else {
      txOverrides.gasPrice = gasPrice;
    }
    
    console.log('🔧 [revealShot] Sending revealShot transaction with:', {
      secret,
      txOverrides: {
        gasLimit: finalGasLimit.toString(),
        maxFeePerGas: txOverrides.maxFeePerGas ? ethers.formatUnits(txOverrides.maxFeePerGas, 'gwei') + ' gwei' : 'N/A',
        maxPriorityFeePerGas: txOverrides.maxPriorityFeePerGas ? ethers.formatUnits(txOverrides.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'N/A',
        gasPrice: txOverrides.gasPrice ? ethers.formatUnits(txOverrides.gasPrice, 'gwei') + ' gwei' : 'N/A'
      }
    });
    
    const tx = await contractWithSigner.revealShot(secret, txOverrides);
    console.log('✅ [revealShot] Transaction sent, hash:', tx.hash);

    updateStatus('waiting_reveal_confirmation', 'Waiting for reveal confirmation...');

    try {
      console.log('🔧 [revealShot] Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('✅ [revealShot] Transaction confirmed:', {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber
      });
      
      updateStatus('processing_reveal', 'Processing reveal result...');
      
      // Check if transaction was successful (status === 1)
      if (receipt.status !== 1) {
        throw new Error('Reveal transaction failed: Transaction reverted');
      }

      // Check if user won by looking at ShotRevealed events (safe parsing)
      console.log('🔧 [revealShot] Parsing transaction logs for ShotRevealed event...');
      console.log('🔧 [revealShot] Total logs:', receipt.logs.length);
      
      let parsedShotRevealed = null;
      for (const [index, log] of receipt.logs.entries()) {
        try {
          console.log(`🔧 [revealShot] Parsing log ${index}:`, {
            address: log.address,
            topics: log.topics
          });
          const parsed = contract.interface.parseLog(log);
          console.log(`🔧 [revealShot] Parsed log ${index}:`, {
            name: parsed?.name,
            args: parsed?.args ? Object.keys(parsed.args) : 'N/A'
          });
          if (parsed?.name === 'ShotRevealed') {
            parsedShotRevealed = parsed;
            console.log('✅ [revealShot] Found ShotRevealed event:', {
              player: parsed.args.player,
              amount: parsed.args.amount?.toString(),
              won: parsed.args.won
            });
            break;
          }
        } catch (parseError) {
          console.log(`🔧 [revealShot] Log ${index} not from this contract (expected):`, parseError.message);
        }
      }

      let won = false;
      if (parsedShotRevealed?.args) {
        won = Boolean(parsedShotRevealed.args.won);
        console.log('🔧 [revealShot] Extracted win result:', won);
      } else {
        console.warn('⚠️ [revealShot] No ShotRevealed event found in transaction logs');
      }
      
      result = {
        hash: receipt.hash,
        receipt,
        won
      };
      console.log('✅ [revealShot] Final result:', result);
    } catch (waitError) {
      console.error('❌ [revealShot] Reveal transaction failed:', waitError);
      console.error('❌ [revealShot] Wait error stack:', waitError.stack);
      
      // Check if this is a transaction revert error
      if (waitError.code === 'CALL_EXCEPTION' || waitError.message?.includes('reverted')) {
        throw new Error(`Reveal transaction reverted: ${waitError.message || 'Unknown error'}`);
      } else {
        throw new Error(`Reveal transaction failed: ${waitError.message || 'Unknown error'}`);
      }
    }
  }

  updateStatus('updating_database', 'Updating database with results...');

  // Update database with reveal results
  try {
    // First, try to find and update the original shot record
    let commitTxHash = null;
    
    // Try to find it in localStorage
    const savedSecretsKey = `ethshot_saved_secrets_${wallet.address}`;
    const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    
    for (const secretKey of existingSecrets) {
      try {
        const secretData = JSON.parse(localStorage.getItem(secretKey) || '{}');
        if (secretData.secret === secret) {
          commitTxHash = secretData.txHash;
          break;
        }
      } catch (e) {
        console.warn('Failed to parse secret data:', e);
      }
    }
    
    if (commitTxHash) {
      // Update the shot record with reveal information
      try {
        const { data, error } = await supabase.rpc('update_shot_on_reveal', {
          p_tx_hash: commitTxHash,
          p_won: result && result.won ? result.won : false,
          p_reveal_tx_hash: result?.hash || null,
          p_reveal_block_number: result?.receipt?.blockNumber || null
        });
        
        if (error) {
          console.error('Failed to update shot record:', error);
          // If the function doesn't exist, try a fallback update
          if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
            console.log('Database function not available, using fallback update method');
            try {
              const { error: fallbackError } = await supabase
                .from('shots')
                .update({
                  won: result && result.won ? result.won : false,
                  reveal_tx_hash: result?.hash || null,
                  reveal_block_number: result?.receipt?.blockNumber || null,
                  reveal_timestamp: new Date().toISOString()
                })
                .eq('tx_hash', commitTxHash);
              
              if (fallbackError) {
                console.error('Fallback update also failed:', fallbackError);
              } else {
                console.log('✅ Shot record updated successfully via fallback method');
              }
            } catch (fallbackUpdateError) {
              console.error('Error in fallback update:', fallbackUpdateError);
            }
          }
        } else {
          console.log('✅ Shot record updated successfully');
        }
      } catch (updateError) {
        console.error('Error calling update_shot_on_reveal:', updateError);
        // Try fallback method if the function call fails completely
        if (updateError.message?.includes('function') || updateError.message?.includes('does not exist')) {
          console.log('Database function not available, using fallback update method');
          try {
            const { error: fallbackError } = await supabase
              .from('shots')
              .update({
                won: result && result.won ? result.won : false,
                reveal_tx_hash: result?.hash || null,
                reveal_block_number: result?.receipt?.blockNumber || null,
                reveal_timestamp: new Date().toISOString()
              })
              .eq('tx_hash', commitTxHash);
            
            if (fallbackError) {
              console.error('Fallback update also failed:', fallbackError);
            } else {
              console.log('✅ Shot record updated successfully via fallback method');
            }
          } catch (fallbackUpdateError) {
            console.error('Error in fallback update:', fallbackUpdateError);
          }
        }
      }
    } else {
      console.warn('Could not find commit transaction hash to update shot record');
    }
    
    if (result && result.won) {
      // Record the winner in the winners table
      // Get the actual pot amount from the game state, not just the shot cost
      const winAmount = gameState.currentPot || gameState.shotCost || '0.0005';
      
      try {
        await db.recordWinner({
          winnerAddress: wallet.address,
          amount: winAmount,
          txHash: result.hash,
          blockNumber: result?.receipt?.blockNumber || null,
          timestamp: new Date().toISOString(),
          cryptoType: gameState.activeCrypto,
          contractAddress: gameState.contractAddress
        });
        
        console.log('✅ Winner recorded successfully with amount:', winAmount);
        
        // Automatically trigger deposit reveal/withdrawal for winnings
        updateStatus('withdrawing_winnings', 'Withdrawing your winnings...');
        
        try {
          if (gameState.isMultiCryptoMode) {
            // Multi-crypto mode: use adapter pattern
            const adapter = getActiveAdapter();
            if (adapter && adapter.withdrawWinnings) {
              const withdrawResult = await adapter.withdrawWinnings(winAmount);
              console.log('✅ Winnings withdrawn successfully via adapter:', withdrawResult);
              result.withdrawResult = withdrawResult;
            } else {
              console.warn('No adapter available for automatic withdrawal');
            }
          } else {
            // ETH-only mode: direct contract interaction for withdrawal
            if (!contract || !ethers || !wallet.signer) {
              console.warn('Contract or signer not available for automatic withdrawal');
            } else {
              const contractWithSigner = contract.connect(wallet.signer);
              
              // Estimate gas for withdrawal
              let gasEstimate;
              try {
                gasEstimate = await contractWithSigner.withdraw.estimateGas();
              } catch (estimateError) {
                console.warn('Failed to estimate gas for withdrawal, using default:', estimateError.message);
                gasEstimate = 100000n;
              }
              
              const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
              
              // Get gas price
              const feeData = await wallet.provider.getFeeData();
              let gasPrice;
              
              if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                gasPrice = feeData.maxFeePerGas;
              } else if (feeData.gasPrice) {
                gasPrice = feeData.gasPrice;
              } else {
                gasPrice = ethers.parseUnits('20', 'gwei');
              }
              
              // Check balance for gas fees
              const balance = await wallet.provider.getBalance(wallet.address);
              const estimatedGasCost = Number(gasLimit) * Number(gasPrice);
              const minRequiredBalance = BigInt(Math.floor(Number(estimatedGasCost) * 0.5));
              
              if (balance < minRequiredBalance) {
                console.warn('Insufficient ETH for withdrawal gas fees');
              } else {
                const withdrawTx = await contractWithSigner.withdraw({
                  gasLimit: gasLimit,
                  maxFeePerGas: feeData.maxFeePerGas || gasPrice,
                  maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || gasPrice
                });
                
                const withdrawReceipt = await withdrawTx.wait();
                
                // Check if withdrawal was successful
                if (withdrawReceipt.status === 1) {
                  console.log('✅ Winnings withdrawn successfully:', withdrawReceipt.hash);
                  result.withdrawResult = {
                    hash: withdrawReceipt.hash,
                    receipt: withdrawReceipt,
                    success: true
                  };
                } else {
                  console.error('❌ Withdrawal transaction failed');
                  result.withdrawResult = {
                    hash: withdrawReceipt.hash,
                    receipt: withdrawReceipt,
                    success: false,
                    error: 'Withdrawal transaction failed'
                  };
                }
              }
            }
          }
        } catch (withdrawError) {
          console.error('❌ Automatic withdrawal failed:', withdrawError);
          result.withdrawResult = {
            success: false,
            error: withdrawError.message
          };
          // Don't throw here - the reveal was successful even if withdrawal failed
        }
      } catch (winnerRecordError) {
        console.error('❌ Failed to record winner, but shot reveal was successful:', winnerRecordError);
        // Don't throw here - the reveal was successful even if winner recording failed
      }
    }
    
    console.log('✅ Database updated with reveal results');
  } catch (dbError) {
    console.error('❌ Failed to update database with reveal results:', dbError);
    // Don't throw here - the reveal was successful even if database update failed
  }

  updateStatus('refreshing_reveal_state', 'Refreshing game state...');

  // Clear cache and refresh state
  rpcCache.clear();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await loadGameState();
  await loadPlayerData(wallet.address);

  updateStatus('reveal_completed', result && result.won ? 'Congratulations! You won!' : 'Shot revealed - Better luck next time!');

  return result;
};