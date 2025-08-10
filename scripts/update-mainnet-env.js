import fs from 'fs';
import path from 'path';

/**
 * Update Environment Variables for Mainnet Deployment
 * 
 * This script helps update environment variables for mainnet deployment
 * based on the deployed contract information.
 */

async function main() {
  console.log('🔧 Updating environment variables for mainnet deployment...\n');

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
  console.log(`🌐 Network: ${deploymentInfo.network || 'mainnet'}`);
  console.log(`🔗 Etherscan: ${deploymentInfo.etherscanUrl}\n`);

  // Generate environment variables
  const envVars = {
    // Network Configuration
    VITE_CHAIN_ID: '1',
    VITE_NETWORK_NAME: 'Ethereum Mainnet',
    VITE_RPC_URL: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    VITE_BLOCK_EXPLORER_URL: 'https://etherscan.io',
    
    // Contract Configuration
    VITE_CONTRACT_ADDRESS: contractAddress,
    
    // Game Configuration (from deployment)
    VITE_SHOT_COST_ETH: deploymentInfo.shotCost || '0.0005',
    VITE_SPONSOR_COST_ETH: deploymentInfo.sponsorCost || '0.001',
    VITE_COOLDOWN_HOURS: '1',
    
    // Payout Configuration
    VITE_WINNER_PAYOUT_PERCENTAGE: '90',
    VITE_HOUSE_FEE_PERCENTAGE: '10',
    VITE_WIN_PERCENTAGE: '1',
    
    // House Configuration
    HOUSE_COMMISSION_ADDRESS: deploymentInfo.deployer,
  };

  console.log('📝 Required Environment Variables for Mainnet:\n');
  
  // Display as .env format
  console.log('# Mainnet Environment Variables');
  console.log('# Copy these to your .env file or deployment platform\n');
  
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`);
  }

  console.log('\n🚨 IMPORTANT NOTES:');
  console.log('1. Replace YOUR_INFURA_KEY with your actual Infura project ID');
  console.log('2. Set these variables in your deployment platform (Vercel, Railway, etc.)');
  console.log('3. For local development, add them to your .env file');
  console.log('4. Make sure ETHERSCAN_API_KEY is set for contract verification');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Update your environment variables');
  console.log('2. Redeploy your application');
  console.log('3. Run: pnpm run verify:mainnet (to verify the contract)');
  console.log('4. Test the application with a wallet connected to mainnet');

  // Write to .env.mainnet file for reference
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync('.env.mainnet', `# Mainnet Environment Variables\n# Generated on ${new Date().toISOString()}\n\n${envContent}\n`);
  console.log('\n✅ Environment variables saved to .env.mainnet for reference');
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });