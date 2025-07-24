// Network debugging tool for ETH Shot
// Run with: node test/network-debug.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 ETH Shot Network Configuration Debug');
console.log('=====================================');
console.log();

// Read .env file to check configuration
try {
  const envPath = join(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  
  // Parse key environment variables
  const getEnvValue = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1] : null;
  };

  const chainId = getEnvValue('VITE_CHAIN_ID');
  const networkName = getEnvValue('VITE_NETWORK_NAME');
  const contractAddress = getEnvValue('VITE_CONTRACT_ADDRESS');
  const rpcUrl = getEnvValue('VITE_RPC_URL');

  console.log('📋 Current Configuration:');
  console.log(`   Chain ID: ${chainId}`);
  console.log(`   Network: ${networkName}`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log();

  console.log('🌐 Network Analysis:');
  if (chainId === '1') {
    console.log('   ✅ Configured for Ethereum Mainnet');
    console.log('   💰 Users can use real ETH');
    console.log('   ⚠️  Make sure contract is deployed on Mainnet!');
  } else if (chainId === '11155111') {
    console.log('   🧪 Configured for Sepolia Testnet');
    console.log('   🎮 Users need testnet ETH to play');
    console.log('   📱 Users must switch their wallet to Sepolia');
    console.log('   🚨 THIS IS LIKELY THE ISSUE!');
  } else {
    console.log(`   ❓ Unknown network (Chain ID: ${chainId})`);
  }
  console.log();

  console.log('🔧 The Problem:');
  console.log('   Your app is configured for Sepolia Testnet, but users visiting');
  console.log('   ethshot.io likely have their wallets connected to Ethereum Mainnet.');
  console.log('   The contract only exists on Sepolia, so the pot shows zero on Mainnet.');
  console.log();

  console.log('💡 Solutions:');
  console.log('   1. Add network detection and prompt users to switch to Sepolia');
  console.log('   2. Deploy contract to Mainnet for production use');
  console.log('   3. Add clear instructions for users to switch networks');
  console.log();

  console.log('🌍 User Instructions (for Sepolia):');
  console.log('   1. Open MetaMask');
  console.log('   2. Click network dropdown (shows "Ethereum Mainnet")');
  console.log('   3. Select "Sepolia test network"');
  console.log('   4. Get testnet ETH from https://sepoliafaucet.com');
  console.log();

  console.log('📝 Contract Verification:');
  console.log(`   Sepolia Explorer: https://sepolia.etherscan.io/address/${contractAddress}`);

} catch (error) {
  console.error('❌ Error reading .env file:', error.message);
}