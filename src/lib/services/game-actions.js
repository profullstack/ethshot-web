/**
 * Game Actions Service
 * 
 * Pure business logic functions for game operations
 * These functions should be called by components or stores, not stored in stores
 */

import { get } from 'svelte/store';
import { getActiveAdapter } from '../crypto/adapters/index.js';
import { toastStore } from '../stores/toast.js';
import { db } from '../database/index.js';
import { rpcCache } from '../stores/game/cache.js';

/**
 * Take a shot in the game
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
  loadPlayerData
}) => {
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

    const contractWithSigner = contract.connect(wallet.signer);
    const shotCost = customShotCost ? ethers.parseEther(customShotCost) : await contract.SHOT_COST();

    // Check user balance
    const balance = await wallet.provider.getBalance(wallet.address);
    
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
    
    const estimatedGasCost = gasLimit * gasPrice;
    const totalCost = shotCost + estimatedGasCost;
    
    console.log('Gas estimation details:', {
      shotCost: ethers.formatEther(shotCost),
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

    // Generate commitment - CRITICAL FIX: Must match contract's expectation
    const secret = ethers.hexlify(ethers.randomBytes(32));
    // Contract expects: keccak256(abi.encodePacked(secret, msg.sender))
    const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, wallet.address]));

    const tx = await contractWithSigner.commitShot(commitment, {
      value: shotCost,
      gasLimit: gasLimit
    });

    const receipt = await tx.wait();
    
    // Store the pending shot information for later reveal
    const pendingShotData = {
      secret,
      commitment,
      commitHash: receipt.hash,
      commitBlock: receipt.blockNumber,
      amount: shotCost.toString(),
      timestamp: Date.now()
    };
    
    // Update game state to show pending shot
    updateGameState(state => ({
      ...state,
      pendingShot: pendingShotData,
      takingShot: false
    }));
    
    // Store secret in localStorage for persistence
    try {
      const secretKey = `ethshot_secret_${wallet.address}_${receipt.hash.slice(0, 10)}`;
      const secretData = {
        secret,
        txHash: receipt.hash,
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
    
    result = {
      hash: receipt.hash,
      receipt,
      secret,
      isCommitOnly: true,
      pendingShot: pendingShotData
    };
  }

  // Log shot to database
  try {
    await db.recordShot({
      playerAddress: wallet.address,
      amount: gameState.shotCost,
      txHash: result.hash,
      blockNumber: result.receipt.blockNumber,
      timestamp: new Date().toISOString(),
      won: false, // Will be updated when revealed
      cryptoType: gameState.activeCrypto
    });
  } catch (dbError) {
    console.error('Failed to log shot to database:', dbError);
  }

  // Clear cache and refresh state
  rpcCache.clear();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await loadGameState();
  await loadPlayerData(wallet.address);

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
    
    const estimatedGasCost = gasLimit * gasPrice;
    const totalCost = sponsorCost + estimatedGasCost;
    
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
      amount: gameState.sponsorCost,
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
 * Reveal a pending shot
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
  loadPlayerData
}) => {
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

    // Check if user has a pending shot
    const hasPending = await contract.hasPendingShot(wallet.address);
    if (!hasPending) {
      throw new Error('No pending shot found to reveal');
    }

    const contractWithSigner = contract.connect(wallet.signer);
    
    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.revealShot.estimateGas(secret);
    } catch (estimateError) {
      console.warn('Failed to estimate gas for reveal, using default:', estimateError.message);
      gasEstimate = 100000n;
    }
    
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
    
    const tx = await contractWithSigner.revealShot(secret, {
      gasLimit: gasLimit
    });

    const receipt = await tx.wait();
    
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

  // Clear cache and refresh state
  rpcCache.clear();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await loadGameState();
  await loadPlayerData(wallet.address);

  return result;
};

/**
 * Clean up expired pending shot
 * @param {Object} params - Parameters object
 * @param {string} params.playerAddress - Player address (optional, defaults to current wallet)
 * @param {Object} params.gameState - Current game state
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.contract - Contract instance (ETH mode)
 * @param {Object} params.ethers - Ethers library (ETH mode)
 * @returns {Promise<Object>} Transaction result
 */
export const cleanupExpiredPendingShot = async ({
  playerAddress = null,
  gameState,
  wallet,
  contract,
  ethers
}) => {
  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (gameState.contractDeployed === false) {
    throw new Error(`${gameState.activeCrypto} contract not deployed yet.`);
  }

  // Default to cleaning up the current user's pending shot
  const targetPlayer = playerAddress || wallet.address;
  
  // Only allow users to clean up their own pending shots for privacy
  if (targetPlayer !== wallet.address) {
    throw new Error('You can only clean up your own pending shots');
  }

  if (gameState.isMultiCryptoMode) {
    // Multi-crypto mode: use adapter pattern
    throw new Error('Cleanup function not yet implemented for multi-crypto mode. Please refresh the page.');
  } else {
    // ETH-only mode: try to call the contract function
    if (!contract || !ethers || !wallet.signer) {
      throw new Error('Contract or signer not available. Please refresh the page.');
    }

    // First check if the pending shot is actually expired
    const hasPending = await contract.hasPendingShot(targetPlayer);
    if (!hasPending) {
      throw new Error('No pending shot found to clean up');
    }

    const pendingShot = await contract.getPendingShot(targetPlayer);
    const currentBlock = await wallet.provider.getBlockNumber();
    const commitBlock = Number(pendingShot.blockNumber);
    const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
    
    const revealExpired = currentBlock > commitBlock + maxRevealDelay;
    
    if (!revealExpired) {
      const blocksRemaining = (commitBlock + maxRevealDelay) - currentBlock;
      throw new Error(`Pending shot is not expired yet. Please wait ${blocksRemaining} more blocks or refresh the page to start over.`);
    }

    // Try to call the cleanup function
    const contractWithSigner = contract.connect(wallet.signer);
    
    // Estimate gas
    let gasEstimate;
    try {
      gasEstimate = await contractWithSigner.cleanupExpiredPendingShot.estimateGas(targetPlayer);
    } catch (estimateError) {
      console.warn('Failed to estimate gas for cleanup, using default:', estimateError.message);
      gasEstimate = 100000n;
    }
    
    const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
    
    const tx = await contractWithSigner.cleanupExpiredPendingShot(targetPlayer, {
      gasLimit: gasLimit
    });

    const receipt = await tx.wait();
    
    return {
      hash: receipt.hash,
      receipt
    };
  }
};