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
    if (onStatusUpdate) {
      onStatusUpdate(status, message);
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

    updateStatus('checking_balance', 'Checking wallet balance...');
    
    // Check user balance
    const balance = await wallet.provider.getBalance(wallet.address);
    
    updateStatus('estimating_gas', 'Estimating gas costs...');
    
    // Estimate gas with proper commitment hash
    let gasEstimate;
    try {
      // Generate a proper commitment for gas estimation
      const tempSecret = 123456;
      const tempCommitment = ethers.keccak256(ethers.solidityPacked(['uint256'], [tempSecret]));
      
      gasEstimate = await contractWithSigner.commitShot.estimateGas(tempCommitment, {
        value: shotCost
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
    const totalCost = Number(shotCost) + Number(estimatedGasCost);

    // For balance check, use the higher of actual cost or custom cost
    const balanceCheckCost = customShotCost ?
      Math.max(Number(ethers.parseEther(customShotCost)), Number(shotCost)) + Number(estimatedGasCost) :
      Number(totalCost);
    
    console.log('Gas estimation details:', {
      shotCost: ethers.formatEther(shotCost),
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
    const secret = ethers.hexlify(ethers.randomBytes(32));
    // Contract expects: keccak256(abi.encodePacked(secret, msg.sender))
    const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, wallet.address]));

    updateStatus('sending_transaction', 'Sending transaction to blockchain...');

    const tx = await contractWithSigner.commitShot(commitment, {
      value: shotCost,
      gasLimit: gasLimit
    });

    updateStatus('waiting_confirmation', 'Waiting for blockchain confirmation...');

    const receipt = await tx.wait();
    
    updateStatus('processing', 'Processing transaction result...');
    
    // Check if this is a first shot (pot is empty) by checking if custom shot cost indicates a first shot
    const isFirstShot = customShotCost && parseFloat(customShotCost) === parseFloat(GAME_CONFIG.FIRST_SHOT_COST_ETH);
    
    if (isFirstShot) {
      // First shot: no secret storage, no reveal needed - just adds to pot
      console.log('🚀 First shot detected - no secret storage or reveal needed');
      result = {
        hash: receipt.hash,
        receipt,
        isCommitOnly: true,
        isFirstShot: true
        // No secret returned for first shots
      };
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
      
      // Automatically reveal the shot after a short delay
      updateStatus('auto_revealing', 'Automatically revealing shot...');
      
      // Wait a moment for blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
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
        
        // Update result with reveal information
        result.revealResult = revealResult;
        result.won = revealResult.won;
      } catch (revealError) {
        console.error('❌ Auto-reveal failed:', revealError);
        
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

    updateStatus('logging_database', 'Recording shot to database...');

    // Log shot to database
    try {
      // Use custom shot cost for display purposes if provided
      const displayAmount = customShotCost ? customShotCost : ethers.formatEther(Number(shotCost));
      
      await db.recordShot({
        playerAddress: wallet.address,
        amount: displayAmount,
        txHash: result.hash,
        blockNumber: result.receipt.blockNumber,
        timestamp: new Date().toISOString(),
        won: result.won || false, // Will be updated when revealed
        cryptoType: gameState.activeCrypto,
        contractAddress: gameState.contractAddress
      });
    } catch (dbError) {
      console.error('Failed to log shot to database:', dbError);
      // Don't throw here - the shot was successful even if logging failed
    }

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
      amount: ethers.formatEther(Number(sponsorCost)),
      txHash: result.hash,
      blockNumber: result.receipt.blockNumber,
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
      gasEstimate = await contractWithSigner.revealShot.estimateGas(secret);
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
    if (onStatusUpdate) {
      onStatusUpdate(status, message);
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
    
    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.revealShot.estimateGas(secret);
    } catch (estimateError) {
      console.warn('Failed to estimate gas for reveal, using default:', estimateError.message);
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
    
    console.log('Reveal gas estimation details:', {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      estimatedGasCost: ethers.formatEther(estimatedGasCost),
      balance: ethers.formatEther(balance)
    });
    
    // Check if user has enough ETH for gas fees with a very lenient buffer for reveals
    const minRequiredBalance = BigInt(Math.floor(Number(estimatedGasCost) * 0.5));
    
    if (balance < minRequiredBalance) {
      const shortfall = ethers.formatEther(minRequiredBalance - balance);
      throw new Error(`Insufficient ETH for gas fees. Need ${shortfall} more ETH. Current balance: ${ethers.formatEther(balance)} ETH`);
    }
    
    updateStatus('sending_reveal', 'Sending reveal transaction...');

    const tx = await contractWithSigner.revealShot(secret, {
      gasLimit: gasLimit,
      maxFeePerGas: feeData.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || gasPrice
    });

    updateStatus('waiting_reveal_confirmation', 'Waiting for reveal confirmation...');

    const receipt = await tx.wait();
    
    updateStatus('processing_reveal', 'Processing reveal result...');

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
    }
    
    result = {
      hash: receipt.hash,
      receipt,
      won
    };
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
          p_reveal_tx_hash: result.hash,
          p_reveal_block_number: result.receipt.blockNumber
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
                  reveal_tx_hash: result.hash,
                  reveal_block_number: result.receipt.blockNumber,
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
                reveal_tx_hash: result.hash,
                reveal_block_number: result.receipt.blockNumber,
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
          blockNumber: result.receipt.blockNumber,
          timestamp: new Date().toISOString(),
          cryptoType: gameState.activeCrypto,
          contractAddress: gameState.contractAddress
        });
        
        console.log('✅ Winner recorded successfully with amount:', winAmount);
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