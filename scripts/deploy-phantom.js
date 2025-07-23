#!/usr/bin/env node

/**
 * ETH Shot Deployment Script for Phantom Wallet Users
 * 
 * This script helps deploy the ETH Shot contract to Sepolia testnet
 * using a private key exported from Phantom wallet.
 * Now supports configurable contract parameters via environment variables.
 */

import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}🔄${colors.reset} ${msg}`),
  rocket: (msg) => console.log(`${colors.magenta}🚀${colors.reset} ${msg}`)
};

/**
 * Load and validate contract configuration from environment variables
 */
function loadContractConfig() {
  log.step('Loading contract configuration from environment...');
  
  const config = {
    shotCostEth: process.env.VITE_SHOT_COST_ETH || '0.001',
    sponsorCostEth: process.env.VITE_SPONSOR_COST_ETH || '0.05',
    winChancePercent: parseInt(process.env.VITE_WIN_PERCENTAGE || '1'),
    winnerPayoutPercent: parseInt(process.env.VITE_WINNER_PAYOUT_PERCENTAGE || '90'),
    houseFeePercent: parseInt(process.env.VITE_HOUSE_FEE_PERCENTAGE || '10'),
    cooldownHours: parseInt(process.env.VITE_COOLDOWN_HOURS || '1')
  };
  
  // Convert ETH values to wei
  config.shotCostWei = ethers.parseEther(config.shotCostEth);
  config.sponsorCostWei = ethers.parseEther(config.sponsorCostEth);
  config.cooldownSeconds = config.cooldownHours * 3600;
  
  // Validate configuration
  if (config.winChancePercent < 1 || config.winChancePercent > 100) {
    throw new Error('CONTRACT_WIN_CHANCE_PERCENT must be between 1 and 100');
  }
  
  if (config.winnerPayoutPercent + config.houseFeePercent !== 100) {
    throw new Error('CONTRACT_WINNER_PAYOUT_PERCENT + CONTRACT_HOUSE_FEE_PERCENT must equal 100');
  }
  
  log.success('Configuration loaded:');
  console.log(`   💰 Shot Cost: ${config.shotCostEth} ETH (${config.shotCostWei} wei)`);
  console.log(`   🎯 Sponsor Cost: ${config.sponsorCostEth} ETH (${config.sponsorCostWei} wei)`);
  console.log(`   🎲 Win Chance: ${config.winChancePercent}%`);
  console.log(`   🏆 Winner Payout: ${config.winnerPayoutPercent}%`);
  console.log(`   🏠 House Fee: ${config.houseFeePercent}%`);
  console.log(`   ⏰ Cooldown: ${config.cooldownHours} hours (${config.cooldownSeconds} seconds)`);
  
  return config;
}

/**
 * Validates environment variables required for deployment
 */
function validateEnvironment() {
  log.step('Validating environment configuration...');
  
  const required = [
    'PRIVATE_KEY',
    'SEPOLIA_RPC_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log.error('Missing required environment variables:');
    missing.forEach(key => console.log(`  - ${key}`));
    log.info('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  // Validate private key format
  if (!process.env.PRIVATE_KEY.startsWith('0x')) {
    log.error('PRIVATE_KEY must start with 0x');
    process.exit(1);
  }
  
  log.success('Environment validation passed');
}

/**
 * Checks wallet balance before deployment
 */
async function checkWalletBalance() {
  log.step('Checking wallet balance...');
  
  try {
    const [signer] = await ethers.getSigners();
    const balance = await signer.provider.getBalance(signer.address);
    const balanceEth = ethers.formatEther(balance);
    
    log.info(`Deployer address: ${signer.address}`);
    log.info(`Balance: ${balanceEth} ETH`);
    
    if (parseFloat(balanceEth) < 0.01) {
      log.warning('Low balance detected. You may need more Sepolia ETH for deployment.');
      log.info('Get Sepolia ETH from: https://sepoliafaucet.com/');
    } else {
      log.success('Sufficient balance for deployment');
    }
    
    return { address: signer.address, balance: balanceEth };
  } catch (error) {
    log.error(`Failed to check wallet balance: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Estimates gas costs for deployment
 */
async function estimateGasCosts(config) {
  log.step('Estimating deployment costs...');
  
  try {
    const EthShot = await ethers.getContractFactory('EthShot');
    const [signer] = await ethers.getSigners();
    
    // Prepare constructor arguments
    const constructorArgs = [
      signer.address,              // initialOwner
      config.shotCostWei,         // _shotCost
      config.sponsorCostWei,      // _sponsorCost
      config.cooldownSeconds,     // _cooldownPeriod
      config.winnerPayoutPercent, // _winPercentage
      config.houseFeePercent,     // _housePercentage
      config.winChancePercent     // _winChance
    ];
    
    const deploymentData = EthShot.getDeployTransaction(...constructorArgs);
    const gasEstimate = await signer.estimateGas(deploymentData);
    const gasPrice = await signer.provider.getFeeData();
    
    const estimatedCost = gasEstimate * gasPrice.gasPrice;
    const estimatedCostEth = ethers.formatEther(estimatedCost);
    
    log.info(`Estimated gas: ${gasEstimate.toString()}`);
    log.info(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
    log.info(`Estimated cost: ${estimatedCostEth} ETH`);
    
    return { gasEstimate, gasPrice: gasPrice.gasPrice, estimatedCost, constructorArgs };
  } catch (error) {
    log.warning(`Could not estimate gas costs: ${error.message}`);
    return null;
  }
}

/**
 * Deploys the ETH Shot contract
 */
async function deployContract(config, constructorArgs) {
  log.rocket('Starting ETH Shot deployment to Sepolia testnet...');
  
  try {
    // Get contract factory
    const EthShot = await ethers.getContractFactory('EthShot');
    
    // Deploy with constructor arguments and explicit gas settings for reliability
    log.step('Deploying contract with configuration...');
    const ethShot = await EthShot.deploy(...constructorArgs, {
      gasLimit: 3000000, // Set explicit gas limit
    });
    
    // Wait for deployment
    log.step('Waiting for deployment confirmation...');
    await ethShot.waitForDeployment();
    
    const contractAddress = await ethShot.getAddress();
    const deploymentTx = ethShot.deploymentTransaction();
    
    log.success(`Contract deployed successfully!`);
    log.info(`Contract address: ${contractAddress}`);
    log.info(`Transaction hash: ${deploymentTx.hash}`);
    log.info(`Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
    
    return { contract: ethShot, address: contractAddress, txHash: deploymentTx.hash, constructorArgs };
  } catch (error) {
    log.error(`Deployment failed: ${error.message}`);
    
    // Provide helpful error messages
    if (error.message.includes('insufficient funds')) {
      log.info('💡 Get more Sepolia ETH from: https://sepoliafaucet.com/');
    } else if (error.message.includes('nonce')) {
      log.info('💡 Try resetting your account in Phantom wallet settings');
    } else if (error.message.includes('gas')) {
      log.info('💡 Try increasing gas limit or gas price');
    }
    
    process.exit(1);
  }
}

/**
 * Verifies contract configuration after deployment
 */
async function verifyContractConfig(contract) {
  log.step('Verifying contract configuration...');
  
  try {
    const shotCost = await contract.SHOT_COST();
    const sponsorCost = await contract.SPONSOR_COST();
    const cooldownPeriod = await contract.COOLDOWN_PERIOD();
    const winChance = await contract.WIN_CHANCE();
    const winPercentage = await contract.WIN_PERCENTAGE();
    const housePercentage = await contract.HOUSE_PERCENTAGE();
    const currentPot = await contract.getCurrentPot();
    
    log.success('Contract configuration verified:');
    console.log(`  💰 Shot cost: ${ethers.formatEther(shotCost)} ETH`);
    console.log(`  🎯 Sponsor cost: ${ethers.formatEther(sponsorCost)} ETH`);
    console.log(`  ⏰ Cooldown: ${cooldownPeriod} seconds (${Number(cooldownPeriod) / 3600} hours)`);
    console.log(`  🎲 Win chance: ${winChance}%`);
    console.log(`  🏆 Winner payout: ${winPercentage}%`);
    console.log(`  🏠 House fee: ${housePercentage}%`);
    console.log(`  💎 Current pot: ${ethers.formatEther(currentPot)} ETH`);
    
    return {
      shotCost: ethers.formatEther(shotCost),
      sponsorCost: ethers.formatEther(sponsorCost),
      cooldownPeriod: Number(cooldownPeriod),
      winChance: Number(winChance),
      winPercentage: Number(winPercentage),
      housePercentage: Number(housePercentage),
      currentPot: ethers.formatEther(currentPot)
    };
  } catch (error) {
    log.error(`Failed to verify contract configuration: ${error.message}`);
    return null;
  }
}

/**
 * Saves deployment information to files
 */
async function saveDeploymentInfo(deploymentData, walletInfo, contractConfig, config) {
  log.step('Saving deployment information...');
  
  // Convert BigInt values to strings for JSON serialization
  const serializableConstructorArgs = deploymentData.constructorArgs.map(arg => {
    if (typeof arg === 'bigint') {
      return arg.toString();
    }
    return arg;
  });
  
  const deploymentInfo = {
    network: 'sepolia',
    chainId: 11155111,
    contractAddress: deploymentData.address,
    transactionHash: deploymentData.txHash,
    deploymentTime: new Date().toISOString(),
    deployer: walletInfo.address,
    deployerBalance: walletInfo.balance,
    etherscanUrl: `https://sepolia.etherscan.io/address/${deploymentData.address}`,
    contractConfig,
    deploymentConfig: {
      shotCostEth: config.shotCostEth,
      sponsorCostEth: config.sponsorCostEth,
      winChancePercent: config.winChancePercent,
      winnerPayoutPercent: config.winnerPayoutPercent,
      houseFeePercent: config.houseFeePercent,
      cooldownHours: config.cooldownHours
    },
    constructorArgs: serializableConstructorArgs,
    rpcUrl: process.env.SEPOLIA_RPC_URL
  };
  
  // Save deployment.json
  const deploymentPath = path.join(process.cwd(), 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  log.success(`Deployment info saved: ${deploymentPath}`);
  
  // Create/update .env.local for frontend
  const envContent = `# ETH Shot Configuration Update
# Generated: ${new Date().toISOString()}

# Contract address (both prefixed and non-prefixed)
VITE_CONTRACT_ADDRESS=${deploymentData.address}
CONTRACT_ADDRESS=${deploymentData.address}

# Frontend configuration (VITE_ prefixed for Vite/SvelteKit)
VITE_RPC_URL=${process.env.SEPOLIA_RPC_URL}
VITE_SEPOLIA_RPC_URL=${process.env.SEPOLIA_RPC_URL}
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111
VITE_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io

# Game configuration (should match deployed contract)
VITE_SHOT_COST_ETH=${config.shotCostEth}
VITE_SPONSOR_COST_ETH=${config.sponsorCostEth}
VITE_WIN_PERCENTAGE=${config.winChancePercent}
VITE_WINNER_PAYOUT_PERCENTAGE=${config.winnerPayoutPercent}
VITE_HOUSE_FEE_PERCENTAGE=${config.houseFeePercent}
VITE_COOLDOWN_HOURS=${config.cooldownHours}

# Deployment configuration (non-prefixed for Hardhat)
SEPOLIA_RPC_URL=${process.env.SEPOLIA_RPC_URL}
MAINNET_RPC_URL=${process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'}
`;
  
  const envPath = path.join(process.cwd(), '.env.local');
  fs.writeFileSync(envPath, envContent);
  log.success(`Frontend config saved: ${envPath}`);
  
  return deploymentInfo;
}

/**
 * Provides next steps guidance
 */
function showNextSteps(deploymentInfo) {
  console.log('\n' + '='.repeat(60));
  log.rocket('Deployment completed successfully!');
  console.log('='.repeat(60));
  
  console.log('\n📋 Next Steps:');
  console.log('1. Verify contract on Etherscan:');
  console.log(`   pnpm hardhat verify --network sepolia ${deploymentInfo.contractAddress} \\`);
  console.log(`     ${deploymentInfo.deployer} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[1]} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[2]} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[3]} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[4]} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[5]} \\`);
  console.log(`     ${deploymentInfo.constructorArgs[6]}`);
  console.log('\n2. Test the frontend:');
  console.log('   pnpm run dev');
  console.log('\n3. Test contract functions:');
  console.log('   pnpm run test:contracts');
  console.log('\n4. Update your Phantom wallet:');
  console.log('   - Switch to Sepolia network');
  console.log('   - Connect to your dApp');
  console.log('   - Test taking a shot');
  
  console.log('\n🔗 Important Links:');
  console.log(`   Contract: ${deploymentInfo.etherscanUrl}`);
  console.log('   Faucet: https://sepoliafaucet.com/');
  console.log('   Docs: ./DEPLOYMENT_GUIDE.md');
  
  console.log('\n🎉 Happy testing!');
}

/**
 * Main deployment function
 */
async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    log.rocket('ETH Shot Phantom Wallet Deployment');
    console.log('='.repeat(60) + '\n');
    
    // Step 1: Validate environment
    validateEnvironment();
    
    // Step 2: Load contract configuration
    let config;
    try {
      config = loadContractConfig();
    } catch (error) {
      log.error(`Configuration error: ${error.message}`);
      process.exit(1);
    }
    
    // Step 3: Check wallet balance
    const walletInfo = await checkWalletBalance();
    
    // Step 4: Estimate costs
    const gasInfo = await estimateGasCosts(config);
    if (!gasInfo) {
      log.error('Failed to estimate gas costs. Aborting deployment.');
      process.exit(1);
    }
    
    // Step 5: Deploy contract
    const deploymentData = await deployContract(config, gasInfo.constructorArgs);
    
    // Step 6: Verify configuration
    const contractConfig = await verifyContractConfig(deploymentData.contract);
    
    // Step 7: Save deployment info
    const deploymentInfo = await saveDeploymentInfo(deploymentData, walletInfo, contractConfig, config);
    
    // Step 8: Show next steps
    showNextSteps(deploymentInfo);
    
  } catch (error) {
    log.error(`Deployment script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      log.error('Deployment failed:', error);
      process.exit(1);
    });
}

export default main;