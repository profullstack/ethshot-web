/**
 * Pending Shot Cleanup Utility
 * 
 * Handles cleanup of expired pending shots on the blockchain
 */

import { get } from 'svelte/store';
import { walletStore } from '../stores/wallet.js';
import { gameStore } from '../stores/game/core.js';

/**
 * Clean up expired pending shot for the current user
 * @returns {Promise<Object>} Transaction receipt
 */
export const cleanupExpiredPendingShot = async () => {
  console.log('🧹 PendingShotCleanup: Starting cleanup...');

  const wallet = get(walletStore);
  const state = get(gameStore);
  
  console.log('🧹 PendingShotCleanup: Wallet check:', {
    connected: wallet.connected,
    address: wallet.address,
    contractDeployed: state.contractDeployed
  });
  
  if (!wallet.connected || !wallet.address) {
    throw new Error('Please connect your wallet first');
  }

  if (state.contractDeployed === false) {
    throw new Error(`${state.activeCrypto} contract not deployed yet.`);
  }

  if (state.isMultiCryptoMode) {
    throw new Error('Cleanup function not yet implemented for multi-crypto mode. Please refresh the page.');
  }

  // Get contract and ethers from state
  const contract = state.contract;
  const ethers = state.ethers;
  
  console.log('🧹 PendingShotCleanup: Contract availability:', {
    contract: !!contract,
    ethers: !!ethers,
    signer: !!wallet.signer
  });
  
  if (!contract || !ethers || !wallet.signer) {
    throw new Error('Contract or signer not available. Please refresh the page.');
  }

  console.log('🧹 PendingShotCleanup: Checking if pending shot exists...');
  
  // First check if the pending shot is actually expired
  const hasPending = await contract.hasPendingShot(wallet.address);
  if (!hasPending) {
    throw new Error('No pending shot found to clean up');
  }

  console.log('🧹 PendingShotCleanup: Getting pending shot details...');
  const pendingShot = await contract.getPendingShot(wallet.address);
  const currentBlock = await wallet.provider.getBlockNumber();
  const commitBlock = Number(pendingShot.blockNumber);
  const maxRevealDelay = 256; // MAX_REVEAL_DELAY from contract
  
  const revealExpired = currentBlock > commitBlock + maxRevealDelay;
  
  console.log('🧹 PendingShotCleanup: Expiration check:', {
    commitBlock,
    currentBlock,
    maxRevealDelay,
    revealExpired,
    blocksRemaining: (commitBlock + maxRevealDelay) - currentBlock
  });
  
  if (!revealExpired) {
    const blocksRemaining = (commitBlock + maxRevealDelay) - currentBlock;
    throw new Error(`Pending shot is not expired yet. Please wait ${blocksRemaining} more blocks.`);
  }

  console.log('🧹 PendingShotCleanup: Calling contract cleanup function...');
  const contractWithSigner = contract.connect(wallet.signer);
  
  // Estimate gas
  let gasEstimate;
  try {
    console.log('🧹 PendingShotCleanup: Estimating gas...');
    gasEstimate = await contractWithSigner.cleanupExpiredPendingShot.estimateGas(wallet.address);
    console.log('🧹 PendingShotCleanup: Gas estimate:', gasEstimate.toString());
  } catch (estimateError) {
    console.warn('🧹 PendingShotCleanup: Failed to estimate gas, using default:', estimateError.message);
    gasEstimate = 100000n;
  }
  
  const gasLimit = gasEstimate < 80000n ? 100000n : gasEstimate + (gasEstimate * 20n / 100n);
  console.log('🧹 PendingShotCleanup: Using gas limit:', gasLimit.toString());
  
  console.log('🧹 PendingShotCleanup: Sending transaction...');
  const tx = await contractWithSigner.cleanupExpiredPendingShot(wallet.address, {
    gasLimit: gasLimit
  });

  console.log('🧹 PendingShotCleanup: Transaction sent, waiting for receipt...', tx.hash);
  const receipt = await tx.wait();
  console.log('🧹 PendingShotCleanup: Transaction confirmed!', receipt.hash);
  
  return {
    hash: receipt.hash,
    receipt
  };
};