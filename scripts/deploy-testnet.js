import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Deploying ETH Shot to Sepolia testnet...\n');

  // Get the contract factory
  const EthShot = await ethers.getContractFactory('EthShot');
  
  // Deploy the contract
  console.log('📝 Deploying contract...');
  const ethShot = await EthShot.deploy();
  
  // Wait for deployment to complete
  await ethShot.waitForDeployment();
  const contractAddress = await ethShot.getAddress();
  
  console.log(`✅ EthShot deployed to: ${contractAddress}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}\n`);

  // Verify contract configuration
  console.log('🔍 Verifying contract configuration...');
  const shotCost = await ethShot.SHOT_COST();
  const sponsorCost = await ethShot.SPONSOR_COST();
  const cooldownPeriod = await ethShot.COOLDOWN_PERIOD();
  
  console.log(`💰 Shot cost: ${ethers.formatEther(shotCost)} ETH`);
  console.log(`🎯 Sponsor cost: ${ethers.formatEther(sponsorCost)} ETH`);
  console.log(`⏰ Cooldown period: ${cooldownPeriod} seconds (${Number(cooldownPeriod) / 3600} hours)\n`);

  // Save deployment info
  const deploymentInfo = {
    network: 'sepolia',
    contractAddress,
    deploymentTime: new Date().toISOString(),
    deployer: (await ethers.getSigners())[0].address,
    shotCost: ethers.formatEther(shotCost),
    sponsorCost: ethers.formatEther(sponsorCost),
    cooldownPeriod: Number(cooldownPeriod),
    etherscanUrl: `https://sepolia.etherscan.io/address/${contractAddress}`
  };

  const deploymentPath = path.join(process.cwd(), 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`📄 Deployment info saved to: ${deploymentPath}`);

  // Create environment file for frontend
  const envContent = `# ETH Shot Environment Configuration
# Generated on ${new Date().toISOString()}

# Smart Contract Configuration
PUBLIC_CONTRACT_ADDRESS=${contractAddress}
PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PUBLIC_NETWORK_NAME=Sepolia Testnet
PUBLIC_CHAIN_ID=11155111

# Supabase Configuration (Update with your values)
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
PUBLIC_APP_URL=https://ethshot.io
NODE_ENV=production
`;

  const envPath = path.join(process.cwd(), '.env.production');
  fs.writeFileSync(envPath, envContent);
  
  console.log(`🔧 Environment file created: ${envPath}`);
  console.log('\n📋 Next steps:');
  console.log('1. Update .env.production with your Supabase and Infura credentials');
  console.log('2. Verify the contract on Etherscan');
  console.log('3. Test all contract functions');
  console.log('4. Deploy frontend to Vercel');
  console.log('5. Update DNS settings for ethshot.io');
  
  // Test basic contract functionality
  console.log('\n🧪 Testing basic contract functionality...');
  
  try {
    const currentPot = await ethShot.getCurrentPot();
    console.log(`✅ Current pot: ${ethers.formatEther(currentPot)} ETH`);
    
    const [signer] = await ethers.getSigners();
    const canShoot = await ethShot.canTakeShot(signer.address);
    console.log(`✅ Can take shot: ${canShoot}`);
    
    const cooldown = await ethShot.getCooldownRemaining(signer.address);
    console.log(`✅ Cooldown remaining: ${cooldown} seconds`);
    
    console.log('\n🎉 Contract deployment and testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing contract:', error.message);
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });