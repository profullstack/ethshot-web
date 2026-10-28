#!/usr/bin/env node

/**
 * ETH Shot Deployment Setup Script
 * 
 * This script helps you set up your environment for deploying
 * the ETH Shot contract using your Phantom wallet.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
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
 * Checks if .env file exists and has required variables
 */
function checkEnvironmentFile() {
  log.step('Checking environment configuration...');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    log.warning('.env file not found');
    
    if (fs.existsSync(envExamplePath)) {
      log.info('Creating .env from .env.example...');
      fs.copyFileSync(envExamplePath, envPath);
      log.success('.env file created');
    } else {
      log.error('.env.example not found. Cannot create .env file.');
      return false;
    }
  }
  
  // Read and check .env content
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'SEPOLIA_RPC_URL',
    'VITE_CONTRACT_ADDRESS'
  ];
  
  const missingVars = requiredVars.filter(varName => {
    const regex = new RegExp(`^${varName}=`, 'm');
    return !regex.test(envContent) || envContent.includes(`${varName}=your-`) || envContent.includes(`${varName}=0x1234`);
  });
  
  if (missingVars.length > 0) {
    log.warning('The following environment variables need to be configured:');
    missingVars.forEach(varName => {
      console.log(`  - ${varName}`);
    });
    return false;
  }
  
  log.success('Environment file looks good');
  return true;
}

/**
 * Provides setup instructions
 */
function showSetupInstructions() {
  console.log('\n' + '='.repeat(60));
  log.rocket('ETH Shot Deployment Setup');
  console.log('='.repeat(60));
  
  console.log('\n📋 Setup Checklist:');
  
  console.log('\n1. 🦊 Configure Phantom Wallet:');
  console.log('   • Open Phantom in Firefox');
  console.log('   • Click the network dropdown (usually shows "Ethereum")');
  console.log('   • Look for "Sepolia" in the available networks');
  console.log('   • If not visible, enable "Show test networks" in settings');
  console.log('   • Select "Sepolia" from the network list');
  console.log('   • Note: Phantom uses built-in RPC endpoints for standard networks');
  
  console.log('\n2. 💰 Get Sepolia ETH:');
  console.log('   • Visit: https://sepoliafaucet.com/');
  console.log('   • Enter your wallet address');
  console.log('   • Request test ETH (you need ~0.01 ETH for deployment)');
  
  console.log('\n3. 🔑 Get Infura API Key:');
  console.log('   • Sign up at: https://infura.io');
  console.log('   • Create a new project');
  console.log('   • Copy your Project ID');
  console.log('   • Your RPC URL: https://sepolia.infura.io/v3/YOUR_PROJECT_ID');
  
  console.log('\n4. 🔐 Export Private Key from Phantom:');
  console.log('   • Open Phantom → Settings');
  console.log('   • Click "Show Secret Recovery Phrase" or "Export Private Key"');
  console.log('   • Enter your password');
  console.log('   • Copy the private key (starts with 0x)');
  console.log('   ⚠️  NEVER share this key or commit it to git!');
  
  console.log('\n5. ⚙️  Configure .env file:');
  console.log('   • Edit .env in your project root');
  console.log('   • Store the deployer key: logicsrc keyring add <file> --name <entry> --type generic, then DEPLOYER_KEYRING=<entry> (or type it at the prompt). Never PRIVATE_KEY in .env.');
  console.log('   • Set SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id');
  console.log('   • Set ETHERSCAN_API_KEY=your_etherscan_key (optional, for verification)');
  console.log('   • Configure game parameters (optional, defaults provided):');
  console.log('     - VITE_SHOT_COST_ETH=0.001 (cost per shot in ETH)');
  console.log('     - VITE_SPONSOR_COST_ETH=0.05 (cost to sponsor in ETH)');
  console.log('     - VITE_WIN_PERCENTAGE=1 (win chance percentage)');
  console.log('     - VITE_WINNER_PAYOUT_PERCENTAGE=90 (winner payout percentage)');
  console.log('     - VITE_HOUSE_FEE_PERCENTAGE=10 (house fee percentage)');
  console.log('     - VITE_COOLDOWN_HOURS=1 (cooldown period in hours)');
  
  console.log('\n6. 🚀 Deploy Contract:');
  console.log('   • Run: pnpm run deploy:phantom');
  console.log('   • Wait for deployment to complete');
  console.log('   • Contract address will be saved automatically');
  
  console.log('\n7. ✅ Verify & Test:');
  console.log('   • Run: pnpm run verify:testnet CONTRACT_ADDRESS');
  console.log('   • Run: pnpm run dev');
  console.log('   • Test wallet connection and game functionality');
  
  console.log('\n🔗 Helpful Links:');
  console.log('   • Sepolia Faucet: https://sepoliafaucet.com/');
  console.log('   • Infura: https://infura.io');
  console.log('   • Etherscan API: https://etherscan.io/apis');
  console.log('   • Deployment Guide: ./DEPLOYMENT_GUIDE.md');
  
  console.log('\n💡 Pro Tips:');
  console.log('   • Keep your private key secure and never share it');
  console.log('   • Test on Sepolia before deploying to mainnet');
  console.log('   • Save your contract address and transaction hash');
  console.log('   • Verify your contract on Etherscan for transparency');
}

/**
 * Shows current environment status
 */
function showEnvironmentStatus() {
  console.log('\n📊 Environment Status:');
  
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log.error('.env file not found');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const checkVar = (varName, description) => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (!match) {
      log.error(`${description}: Not set`);
      return false;
    }
    
    const value = match[1].trim();
    if (value.includes('your-') || value.includes('0x1234') || value === '') {
      log.warning(`${description}: Needs configuration`);
      return false;
    }
    
    // Mask sensitive values
    const maskedValue = varName === 'PRIVATE_KEY' ? 
      `${value.substring(0, 6)}...${value.substring(value.length - 4)}` : 
      value.length > 50 ? `${value.substring(0, 30)}...` : value;
    
    log.success(`${description}: ${maskedValue}`);
    return true;
  };
  
  const checks = [
    checkVar('PRIVATE_KEY', 'Private Key'),
    checkVar('SEPOLIA_RPC_URL', 'Sepolia RPC URL'),
    checkVar('VITE_RPC_URL', 'Frontend RPC URL'),
    checkVar('ETHERSCAN_API_KEY', 'Etherscan API Key (optional)')
  ];
  
  const configured = checks.filter(Boolean).length;
  const total = checks.length - 1; // Etherscan is optional
  
  console.log(`\n📈 Configuration: ${configured}/${total} required variables set`);
  
  if (configured >= total) {
    log.success('Ready for deployment! Run: pnpm run deploy:phantom');
  } else {
    log.warning('Please configure missing variables before deployment');
  }
}

/**
 * Main setup function
 */
function main() {
  console.log('\n' + '='.repeat(60));
  log.rocket('ETH Shot Deployment Setup Assistant');
  console.log('='.repeat(60));
  
  // Check if environment is configured
  const envConfigured = checkEnvironmentFile();
  
  if (envConfigured) {
    showEnvironmentStatus();
    console.log('\n🎉 Environment is configured! You can now deploy with:');
    console.log('   pnpm run deploy:phantom');
  } else {
    showSetupInstructions();
  }
  
  console.log('\n📚 For detailed instructions, see: ./DEPLOYMENT_GUIDE.md');
  console.log('🆘 Need help? Check the troubleshooting section in the guide.');
}

// Run the setup assistant
main();