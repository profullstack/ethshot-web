import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config';

async function updateVercelContractAddress() {
  console.log('🚀 Updating contract address on Vercel...\n');

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

    // Check if Vercel CLI is available
    try {
      execSync('vercel --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Vercel CLI not found. Please install it first:');
      console.error('   pnpm add -g vercel');
      process.exit(1);
    }

    // Update environment variable on Vercel
    console.log('🔧 Updating VITE_CONTRACT_ADDRESS on Vercel...');
    
    // Use a more reliable approach: remove without specifying environment
    console.log('🗑️  Removing existing VITE_CONTRACT_ADDRESS...');
    
    try {
      // Try the simpler removal command that Vercel suggests
      execSync('vercel env rm VITE_CONTRACT_ADDRESS', { stdio: 'inherit' });
      console.log('✅ Existing variable removed');
      
      // Add a small delay to ensure removal is processed
      console.log('⏳ Waiting for removal to process...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log('ℹ️  No existing variable to remove (this is normal for first-time setup)');
    }

    // Add the new environment variable
    console.log('➕ Adding new VITE_CONTRACT_ADDRESS...');
    
    try {
      // Use interactive mode directly since automated input seems unreliable
      console.log('📝 Please enter the contract address when prompted:');
      console.log(`Contract Address: ${contractAddress}\n`);
      
      execSync('vercel env add VITE_CONTRACT_ADDRESS production', { stdio: 'inherit' });
      console.log('\n✅ Contract address updated on Vercel!');
      
    } catch (error) {
      console.error('❌ Failed to add environment variable:', error.message);
      console.log('\n💡 Manual steps:');
      console.log('1. Run: vercel env rm VITE_CONTRACT_ADDRESS');
      console.log('2. Run: vercel env add VITE_CONTRACT_ADDRESS production');
      console.log(`3. Enter: ${contractAddress}`);
      throw error;
    }
    console.log('\n📋 Next steps:');
    console.log('1. Redeploy your application: vercel --prod');
    console.log('2. Or trigger a new deployment from Vercel dashboard');
    console.log('3. Verify the new contract address is working in production');

  } catch (error) {
    console.error('❌ Error updating Vercel environment:', error.message);
    
    if (error.message.includes('deployment.json')) {
      console.log('\n💡 Tip: Run a contract deployment first to generate deployment.json');
    } else if (error.message.includes('vercel')) {
      console.log('\n💡 Tip: Make sure you are logged in to Vercel CLI:');
      console.log('   vercel login');
    }
    
    process.exit(1);
  }
}

updateVercelContractAddress();