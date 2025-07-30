/**
 * Contract Diagnostic Script
 *
 * Checks for common issues that prevent shots from completing
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Node.js compatible config
const NETWORK_CONFIG = {
  RPC_URL: process.env.VITE_RPC_URL || process.env.PUBLIC_RPC_URL || 'http://localhost:8545',
  CONTRACT_ADDRESS: process.env.VITE_CONTRACT_ADDRESS || process.env.PUBLIC_CONTRACT_ADDRESS,
  CHAIN_ID: parseInt(process.env.VITE_CHAIN_ID || process.env.PUBLIC_CHAIN_ID || '31337')
};

async function diagnoseContract() {
  console.log('🔍 Diagnosing contract issues...\n');
  
  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.RPC_URL);
    
    // Get contract instance
    const contractABI = [
      "function SHOT_COST() view returns (uint256)",
      "function MIN_POT_SIZE() view returns (uint256)", 
      "function WIN_CHANCE_BP() view returns (uint256)",
      "function getCurrentPot() view returns (uint256)",
      "function getTestModeConfig() view returns (bool, bool, uint256)",
      "function canCommitShot(address) view returns (bool)",
      "function canRevealShot(address) view returns (bool)",
      "function hasPendingShot(address) view returns (bool)",
      "function getPendingShot(address) view returns (bool, uint256, uint256)"
    ];
    
    const contract = new ethers.Contract(NETWORK_CONFIG.CONTRACT_ADDRESS, contractABI, provider);
    
    // Get contract configuration
    const shotCost = await contract.SHOT_COST();
    const minPotSize = await contract.MIN_POT_SIZE();
    const winChance = await contract.WIN_CHANCE_BP();
    const currentPot = await contract.getCurrentPot();
    const [testMode, fiftyPercentMode, chainId] = await contract.getTestModeConfig();
    
    console.log('📊 Contract Configuration:');
    console.log(`   Shot Cost: ${ethers.formatEther(shotCost)} ETH`);
    console.log(`   Min Pot Size: ${ethers.formatEther(minPotSize)} ETH`);
    console.log(`   Current Pot: ${ethers.formatEther(currentPot)} ETH`);
    console.log(`   Win Chance: ${winChance / 100}% (${winChance} basis points)`);
    console.log(`   Test Mode: ${testMode}`);
    console.log(`   50% Mode: ${fiftyPercentMode}`);
    console.log(`   Chain ID: ${chainId}\n`);
    
    // Check for critical issues
    console.log('🚨 Critical Issue Analysis:');
    
    // Issue 1: First shot problem
    if (minPotSize > shotCost) {
      console.log('❌ CRITICAL: MIN_POT_SIZE > SHOT_COST');
      console.log(`   Min Pot: ${ethers.formatEther(minPotSize)} ETH`);
      console.log(`   Shot Cost: ${ethers.formatEther(shotCost)} ETH`);
      console.log('   First shots will FAIL at reveal phase!');
      console.log('   Solution: Set MIN_POT_SIZE <= SHOT_COST\n');
    } else {
      console.log('✅ MIN_POT_SIZE check passed\n');
    }
    
    // Issue 2: Empty pot first shot
    if (currentPot === 0n) {
      console.log('⚠️  WARNING: Empty pot detected');
      console.log('   First shot will never win due to canWin logic');
      console.log('   This is by design but may confuse users\n');
    }
    
    // Issue 3: Win chance
    if (winChance === 0n) {
      console.log('❌ CRITICAL: WIN_CHANCE_BP is 0');
      console.log('   No shots can ever win!');
      console.log('   Solution: Set WIN_CHANCE_BP > 0\n');
    } else if (winChance > 10000n) {
      console.log('❌ CRITICAL: WIN_CHANCE_BP > 10000 (100%)');
      console.log('   Invalid win chance configuration\n');
    } else {
      console.log(`✅ Win chance configured: ${Number(winChance) / 100}%\n`);
    }
    
    // Issue 4: Test mode analysis
    if (testMode) {
      console.log('🧪 Test Mode Analysis:');
      console.log(`   Test Mode: ${testMode}`);
      console.log(`   50% Win Mode: ${fiftyPercentMode}`);
      if (fiftyPercentMode) {
        console.log('   Shots should win ~50% of the time');
      } else {
        console.log('   Shots win based on testWinningNumber (check contract)');
      }
      console.log('');
    }
    
    // Get current block info
    const currentBlock = await provider.getBlockNumber();
    const blockInfo = await provider.getBlock(currentBlock);
    
    console.log('⛓️  Blockchain Info:');
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Block Time: ${new Date(blockInfo.timestamp * 1000).toISOString()}`);
    console.log(`   Chain ID: ${chainId}\n`);
    
    console.log('🔧 Recommendations:');
    
    if (minPotSize > shotCost) {
      console.log('1. URGENT: Fix MIN_POT_SIZE configuration');
      console.log('   Deploy new contract or update if upgradeable');
    }
    
    if (currentPot === 0n && !testMode) {
      console.log('2. Consider pre-funding the pot for better UX');
      console.log('   Send some ETH to contract to bootstrap');
    }
    
    if (winChance < 100n) { // Less than 1%
      console.log('3. Win chance seems very low for testing');
      console.log('   Consider enabling test mode for development');
    }
    
    console.log('\n✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    
    if (error.message.includes('could not detect network')) {
      console.log('\n💡 Tip: Check your RPC_URL in NETWORK_CONFIG');
    }
    
    if (error.message.includes('call revert exception')) {
      console.log('\n💡 Tip: Check CONTRACT_ADDRESS in NETWORK_CONFIG');
    }
  }
}

// Run diagnosis
diagnoseContract().catch(console.error);