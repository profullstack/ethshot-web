import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

/**
 * Contract Verification Script
 *
 * This script verifies the deployed EthShot contract on the configured network's block explorer
 * so that function names appear properly instead of raw signatures.
 *
 * Usage: node scripts/verify-contract.js
 */

// Get network configuration from environment
const getNetworkConfig = () => {
  const chainId = parseInt(process.env.VITE_CHAIN_ID || process.env.PUBLIC_CHAIN_ID || '11155111');
  const networkName = process.env.VITE_NETWORK_NAME || process.env.PUBLIC_NETWORK_NAME || 'Sepolia Testnet';
  const blockExplorerUrl = process.env.VITE_BLOCK_EXPLORER_URL || process.env.PUBLIC_BLOCK_EXPLORER_URL || 'https://sepolia.etherscan.io';
  
  // Map chain ID to Hardhat network name
  const networkMap = {
    1: 'mainnet',
    11155111: 'sepolia',
    8453: 'base',
    42161: 'arbitrum'
  };
  
  const hardhatNetwork = networkMap[chainId] || 'sepolia';
  
  return {
    chainId,
    networkName,
    blockExplorerUrl,
    hardhatNetwork
  };
};

async function main() {
  const networkConfig = getNetworkConfig();
  console.log(`🔍 Verifying EthShot contract on ${networkConfig.networkName}...\n`);

  // Read deployment info
  const deploymentPath = path.join(process.cwd(), 'deployment.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ deployment.json not found. Please deploy the contract first.');
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;

  if (!contractAddress) {
    console.error('❌ Contract address not found in deployment.json');
    process.exit(1);
  }

  console.log(`📋 Contract Address: ${contractAddress}`);
  console.log(`🌐 Network: ${deploymentInfo.network || networkConfig.hardhatNetwork}`);
  console.log(`🔗 Chain ID: ${networkConfig.chainId}`);

  // Import ethers
  const { ethers } = await import('ethers');

  // Constructor arguments (must match deployment script)
  const initialOwner = deploymentInfo.deployer;
  const houseAddress = process.env.HOUSE_COMMISSION_ADDRESS || deploymentInfo.deployer;
  const shotCost = ethers.parseEther(process.env.VITE_SHOT_COST_ETH || "0.001");
  const sponsorCost = ethers.parseEther(process.env.VITE_SPONSOR_COST_ETH || "0.01");
  const cooldownPeriod = (parseInt(process.env.VITE_COOLDOWN_HOURS || "1")) * 60 * 60;
  const winPercentageBP = (parseFloat(process.env.VITE_WINNER_PAYOUT_PERCENTAGE || "90")) * 100;
  const housePercentageBP = (parseFloat(process.env.VITE_HOUSE_FEE_PERCENTAGE || "10")) * 100;
  const winChanceBP = (parseFloat(process.env.VITE_WIN_PERCENTAGE || "1")) * 100;
  const maxRecentWinners = parseInt(process.env.VITE_RECENT_WINNERS_LIMIT || "100");
  const minPotSize = shotCost;

  // Format constructor arguments for CLI
  const constructorArgs = [
    `"${initialOwner}"`,
    `"${houseAddress}"`,
    shotCost.toString(),
    sponsorCost.toString(),
    cooldownPeriod.toString(),
    winPercentageBP.toString(),
    housePercentageBP.toString(),
    winChanceBP.toString(),
    maxRecentWinners.toString(),
    minPotSize.toString()
  ].join(' ');

  console.log('\n📝 Constructor Arguments:');
  console.log(`  Initial Owner: ${initialOwner}`);
  console.log(`  House Address: ${houseAddress}`);
  console.log(`  Shot Cost: ${ethers.formatEther(shotCost)} ETH`);
  console.log(`  Sponsor Cost: ${ethers.formatEther(sponsorCost)} ETH`);
  console.log(`  Cooldown Period: ${cooldownPeriod} seconds`);
  console.log(`  Win Percentage: ${winPercentageBP / 100}%`);
  console.log(`  House Percentage: ${housePercentageBP / 100}%`);
  console.log(`  Win Chance: ${winChanceBP / 100}%`);
  console.log(`  Max Recent Winners: ${maxRecentWinners}`);
  console.log(`  Min Pot Size: ${ethers.formatEther(minPotSize)} ETH\n`);

  try {
    console.log('⏳ Starting verification process...');
    
    // Use hardhat CLI directly with proper network specification
    const command = `npx hardhat verify --network ${networkConfig.hardhatNetwork} ${contractAddress} ${constructorArgs}`;
    console.log(`🔧 Running: ${command}\n`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log(output);
    console.log('\n✅ Contract verification completed successfully!');
    console.log(`🔗 View verified contract: ${networkConfig.blockExplorerUrl}/address/${contractAddress}#code`);
    console.log('\n📋 After verification:');
    console.log('• Function names will appear instead of signatures (0x736036b1 → revealShot)');
    console.log('• Transaction details will be more readable');
    console.log(`• Users can interact with the contract directly on the block explorer`);

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract is already verified!');
      console.log(`🔗 View contract: ${networkConfig.blockExplorerUrl}/address/${contractAddress}#code`);
    } else if (error.message.includes('ETHERSCAN_API_KEY')) {
      console.log('\n💡 To fix this:');
      if (networkConfig.chainId === 1) {
        console.log('1. Get an API key from https://etherscan.io/apis');
        console.log('2. Add ETHERSCAN_API_KEY=your-key to your .env file');
      } else if (networkConfig.chainId === 11155111) {
        console.log('1. Get an API key from https://etherscan.io/apis');
        console.log('2. Add ETHERSCAN_API_KEY=your-key to your .env file');
      } else {
        console.log(`1. Get an API key for ${networkConfig.networkName} block explorer`);
        console.log('2. Add the appropriate API key to your .env file');
      }
      console.log('3. Run this script again');
    } else {
      console.log('\n💡 Common issues:');
      console.log('• Check that constructor arguments match deployment');
      console.log('• Ensure the correct API key is set in .env');
      console.log('• Wait a few minutes after deployment before verifying');
      console.log(`• Verify the network (${networkConfig.hardhatNetwork}) is correctly configured in hardhat.config.js`);
    }
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });