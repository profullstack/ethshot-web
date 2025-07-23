#!/usr/bin/env node

/**
 * Test script to verify wallet connection functionality
 * Run with: node test-wallet-connection.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('🧪 Testing ETH Shot Wallet Connection Dependencies...\n');

// Test 1: Check if ethers is available
console.log('1. Testing ethers library...');
try {
  const ethers = await import('ethers');
  console.log('✅ Ethers loaded successfully');
  console.log('   Version:', ethers.version || 'Unknown');
  
  // Test basic ethers functionality
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/demo');
  console.log('✅ JsonRpcProvider created successfully');
} catch (error) {
  console.log('❌ Ethers failed:', error.message);
}

// Test 2: Check if Web3Modal is available (optional)
console.log('\n2. Testing Web3Modal library...');
try {
  const web3Modal = await import('web3modal');
  console.log('✅ Web3Modal loaded successfully');
} catch (error) {
  console.log('⚠️  Web3Modal not available (this is OK, we use direct connection):', error.message);
}

// Test 3: Check if WalletConnect is available (optional)
console.log('\n3. Testing WalletConnect library...');
try {
  const walletConnect = await import('@walletconnect/web3-provider');
  console.log('✅ WalletConnect loaded successfully');
} catch (error) {
  console.log('⚠️  WalletConnect not available (this is OK, we use direct connection):', error.message);
}

// Test 4: Check environment variables
console.log('\n4. Testing environment configuration...');
const requiredEnvVars = [
  'VITE_CONTRACT_ADDRESS',
  'VITE_RPC_URL',
  'VITE_CHAIN_ID'
];

let envOk = true;
for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  if (value) {
    console.log(`✅ ${envVar}: ${value}`);
  } else {
    console.log(`❌ ${envVar}: Not set`);
    envOk = false;
  }
}

// Test 5: Test contract connection
console.log('\n5. Testing contract connection...');
try {
  const ethers = await import('ethers');
  const contractAddress = process.env.VITE_CONTRACT_ADDRESS || '0xa6F8E4091D9D56A61101B1B2604451B85Eb69Dc7';
  const rpcUrl = process.env.VITE_RPC_URL || 'https://sepolia.infura.io/v3/9ffe04da38034641bbbaa5883cec1a01';
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ['function SHOT_COST() external view returns (uint256)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  console.log('✅ Contract instance created');
  console.log('   Address:', contractAddress);
  console.log('   RPC URL:', rpcUrl);
  
  // Try to call a view function
  try {
    const shotCost = await contract.SHOT_COST();
    console.log('✅ Contract call successful');
    console.log('   Shot cost:', ethers.formatEther(shotCost), 'ETH');
  } catch (contractError) {
    console.log('❌ Contract call failed:', contractError.message);
    console.log('   This might mean the contract is not deployed or the RPC is rate limited');
  }
} catch (error) {
  console.log('❌ Contract connection test failed:', error.message);
}

console.log('\n🏁 Test completed!');
console.log('\nNext steps:');
console.log('1. Run: pnpm dev');
console.log('2. Open browser to http://localhost:5173');
console.log('3. Open browser console to see detailed logs');
console.log('4. Try connecting wallet and taking a shot');