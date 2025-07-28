/**
 * Pre-fund Contract Script
 * 
 * This script pre-funds the EthShot contract to bypass the validPotSize modifier
 * that prevents the first shot from being taken when the pot is empty.
 */

import { ethers } from 'ethers';
import { config } from 'dotenv';

// Load environment variables
config();

const NETWORK_CONFIG = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/' + process.env.INFURA_PROJECT_ID,
    contractAddress: process.env.CONTRACT_ADDRESS_SEPOLIA
  },
  mainnet: {
    rpcUrl: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/' + process.env.INFURA_PROJECT_ID,
    contractAddress: process.env.CONTRACT_ADDRESS_MAINNET
  }
};

/**
 * Pre-fund the contract to allow first shots
 * @param {string} network - Network name (sepolia, mainnet)
 * @param {string} privateKey - Private key of the funding account
 * @param {string} fundingAmount - Amount to fund in ETH (e.g., "0.01")
 */
async function prefundContract(network = 'sepolia', privateKey, fundingAmount = '0.01') {
  try {
    console.log(`🚀 Pre-funding EthShot contract on ${network}...`);
    
    const networkConfig = NETWORK_CONFIG[network];
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${network}`);
    }
    
    if (!networkConfig.contractAddress) {
      throw new Error(`Contract address not configured for ${network}`);
    }
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`📡 Connected to ${network}`);
    console.log(`👛 Funding from: ${wallet.address}`);
    console.log(`🎯 Contract: ${networkConfig.contractAddress}`);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    const fundingAmountWei = ethers.parseEther(fundingAmount);
    
    console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`💸 Funding amount: ${fundingAmount} ETH`);
    
    if (balance < fundingAmountWei) {
      throw new Error(`Insufficient balance. Need ${fundingAmount} ETH but have ${ethers.formatEther(balance)} ETH`);
    }
    
    // Get current pot size
    const contractABI = [
      "function getCurrentPot() external view returns (uint256)",
      "function SHOT_COST() external view returns (uint256)",
      "function MIN_POT_SIZE() external view returns (uint256)"
    ];
    
    const contract = new ethers.Contract(networkConfig.contractAddress, contractABI, provider);
    const currentPot = await contract.getCurrentPot();
    const shotCost = await contract.SHOT_COST();
    const minPotSize = await contract.MIN_POT_SIZE();
    
    console.log(`📊 Current pot: ${ethers.formatEther(currentPot)} ETH`);
    console.log(`🎯 Shot cost: ${ethers.formatEther(shotCost)} ETH`);
    console.log(`📏 Min pot size: ${ethers.formatEther(minPotSize)} ETH`);
    
    if (currentPot >= minPotSize) {
      console.log('✅ Contract already has sufficient pot size. No funding needed.');
      return;
    }
    
    // Calculate required funding
    const requiredFunding = minPotSize - currentPot;
    const actualFunding = fundingAmountWei > requiredFunding ? requiredFunding : fundingAmountWei;
    
    console.log(`💡 Required funding: ${ethers.formatEther(requiredFunding)} ETH`);
    console.log(`💸 Actual funding: ${ethers.formatEther(actualFunding)} ETH`);
    
    // Send ETH directly to contract (this will be rejected by the contract's receive function)
    // Instead, we need to call a payable function or the owner needs to send ETH
    console.log('⚠️  Note: Direct ETH transfers are rejected by the contract.');
    console.log('💡 Solution: The contract owner should deploy with initial funding or modify the contract.');
    console.log('🔧 Alternative: Deploy a new contract version without the validPotSize modifier on commitShot.');
    
    // For now, let's try to send ETH anyway to demonstrate the issue
    try {
      const tx = await wallet.sendTransaction({
        to: networkConfig.contractAddress,
        value: actualFunding,
        gasLimit: 21000
      });
      
      console.log(`📤 Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      
    } catch (sendError) {
      console.error('❌ Direct transfer failed (expected):', sendError.message);
      console.log('💡 This confirms the contract rejects direct transfers.');
    }
    
  } catch (error) {
    console.error('❌ Pre-funding failed:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const network = args[0] || 'sepolia';
  const privateKey = args[1] || process.env.PRIVATE_KEY;
  const fundingAmount = args[2] || '0.01';
  
  if (!privateKey) {
    console.error('❌ Private key required. Provide as argument or set PRIVATE_KEY env var.');
    process.exit(1);
  }
  
  await prefundContract(network, privateKey, fundingAmount);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { prefundContract };