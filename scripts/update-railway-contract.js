import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';

async function updateRailwayContractAddress() {
  console.log('🚂 Updating contract address on Railway...\n');

  try {
    // Check if deployment.json exists
    const deploymentPath = path.join(process.cwd(), 'deployment.json');
    if (!fs.existsSync(deploymentPath)) {
      console.error('❌ deployment.json not found. Please deploy the contract first.');
      process.exit(1);
    }

    // Read deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const contractAddress = deploymentInfo.contractAddress;

    if (!contractAddress) {
      console.error('❌ No contract address found in deployment.json');
      process.exit(1);
    }

    console.log(`📋 Contract Address: ${contractAddress}`);
    console.log(`🌐 Network: ${deploymentInfo.network || 'unknown'}`);
    console.log(`📅 Deployed: ${deploymentInfo.deploymentTime || 'unknown'}\n`);

    // Check if Railway CLI is available
    try {
      execSync('railway --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Railway CLI not found. Please install it first:');
      console.error('   pnpm add -g @railway/cli');
      console.error('   # or');
      console.error('   npm install -g @railway/cli');
      process.exit(1);
    }

    // Check if logged in to Railway
    try {
      execSync('railway whoami', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Not logged in to Railway. Please login first:');
      console.error('   railway login');
      process.exit(1);
    }

    console.log('🔧 Updating VITE_CONTRACT_ADDRESS on Railway...');

    // Railway doesn't have a direct way to remove variables, so we just set/update
    try {
      console.log('➕ Setting VITE_CONTRACT_ADDRESS...');
      const setCommand = `railway variables --set "VITE_CONTRACT_ADDRESS=${contractAddress}"`;
      
      execSync(setCommand, { stdio: 'inherit' });
      console.log('\n✅ Contract address updated on Railway!');
      
    } catch (error) {
      console.error('❌ Failed to set environment variable:', error.message);
      console.log('\n💡 Manual steps:');
      console.log('1. Run: railway login (if not logged in)');
      console.log('2. Run: railway link (to link to your project)');
      console.log(`3. Run: railway variables --set "VITE_CONTRACT_ADDRESS=${contractAddress}"`);
      throw error;
    }

    console.log('\n📋 Next steps:');
    console.log('1. Railway will automatically redeploy with the new environment variable');
    console.log('2. Check the Railway dashboard to monitor the deployment');
    console.log('3. Verify the new contract address is working in your Railway app');

  } catch (error) {
    console.error('❌ Error updating Railway environment:', error.message);
    
    if (error.message.includes('deployment.json')) {
      console.log('\n💡 Tip: Run a contract deployment first to generate deployment.json');
    } else if (error.message.includes('railway')) {
      console.log('\n💡 Tip: Make sure you are logged in to Railway CLI:');
      console.log('   railway login');
      console.log('   railway link  # to link to your project');
    }
    
    process.exit(1);
  }
}

updateRailwayContractAddress();