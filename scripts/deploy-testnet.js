import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Deploying ETH Shot to Sepolia testnet...\n');

  // Get the contract factory
  const EthShot = await ethers.getContractFactory('EthShot');
  
  // Deploy the contract
  console.log('📝 Deploying contract...');
  const [signer] = await ethers.getSigners();
  
  // Contract constructor parameters
  const initialOwner = signer.address;
  const shotCost = ethers.parseEther("0.001");      // 0.001 ETH per shot
  const sponsorCost = ethers.parseEther("0.01");    // 0.01 ETH for sponsorship
  const cooldownPeriod = 1 * 60 * 60;               // 1 hour in seconds
  const winPercentageBP = 9000;                     // Winner gets 90% of pot (in basis points)
  const housePercentageBP = 1000;                   // House gets 10% of pot (in basis points)
  const winChanceBP = 100;                          // 1% chance to win (in basis points)
  const maxRecentWinners = 100;                     // Maximum number of recent winners to store
  const minPotSize = ethers.parseEther("0.001");    // Minimum pot size (same as shot cost)
  
  console.log('📋 Contract parameters:');
  console.log(`  Initial Owner: ${initialOwner}`);
  console.log(`  Shot Cost: ${ethers.formatEther(shotCost)} ETH`);
  console.log(`  Sponsor Cost: ${ethers.formatEther(sponsorCost)} ETH`);
  console.log(`  Cooldown Period: ${cooldownPeriod} seconds (${cooldownPeriod / 3600} hours)`);
  console.log(`  Win Percentage: ${winPercentageBP / 100}%`);
  console.log(`  House Percentage: ${housePercentageBP / 100}%`);
  console.log(`  Win Chance: ${winChanceBP / 100}%`);
  console.log(`  Max Recent Winners: ${maxRecentWinners}`);
  console.log(`  Min Pot Size: ${ethers.formatEther(minPotSize)} ETH\n`);
  
  const ethShot = await EthShot.deploy(
    initialOwner,
    shotCost,
    sponsorCost,
    cooldownPeriod,
    winPercentageBP,
    housePercentageBP,
    winChanceBP,
    maxRecentWinners,
    minPotSize
  );
  
  // Wait for deployment to complete
  await ethShot.waitForDeployment();
  const contractAddress = await ethShot.getAddress();
  
  console.log(`✅ EthShot deployed to: ${contractAddress}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}\n`);

  // Verify contract configuration
  console.log('🔍 Verifying contract configuration...');
  const contractShotCost = await ethShot.SHOT_COST();
  const contractSponsorCost = await ethShot.SPONSOR_COST();
  const contractCooldownPeriod = await ethShot.COOLDOWN_PERIOD();
  
  console.log(`💰 Shot cost: ${ethers.formatEther(contractShotCost)} ETH`);
  console.log(`🎯 Sponsor cost: ${ethers.formatEther(contractSponsorCost)} ETH`);
  console.log(`⏰ Cooldown period: ${contractCooldownPeriod} seconds (${Number(contractCooldownPeriod) / 3600} hours)\n`);

  // Save deployment info
  const deploymentInfo = {
    network: 'sepolia',
    contractAddress,
    deploymentTime: new Date().toISOString(),
    deployer: (await ethers.getSigners())[0].address,
    shotCost: ethers.formatEther(contractShotCost),
    sponsorCost: ethers.formatEther(contractSponsorCost),
    cooldownPeriod: Number(contractCooldownPeriod),
    etherscanUrl: `https://sepolia.etherscan.io/address/${contractAddress}`
  };

  const deploymentPath = path.join(process.cwd(), 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`📄 Deployment info saved to: ${deploymentPath}`);

  // Create environment file for frontend
  const envContent = `# ETH Shot Environment Configuration
# Generated on ${new Date().toISOString()}

# Smart Contract Configuration
VITE_CONTRACT_ADDRESS=${contractAddress}
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111

# Supabase Configuration (Update with your values)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
VITE_APP_URL=https://ethshot.io
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