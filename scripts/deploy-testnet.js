import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function main() {
  console.log('🚀 Deploying ETH Shot to Sepolia testnet...\n');

  // Get the contract factory
  const EthShot = await ethers.getContractFactory('EthShot');
  
  // Deploy the contract
  console.log('📝 Deploying contract...');
  const [signer] = await ethers.getSigners();
  
  // Contract constructor parameters (from environment variables)
  const initialOwner = signer.address; // Contract owner should be the deployer (for admin privileges)
  const shotCost = ethers.parseEther(process.env.VITE_SHOT_COST_ETH || "0.001");
  const sponsorCost = ethers.parseEther(process.env.VITE_SPONSOR_COST_ETH || "0.01");
  const cooldownPeriod = (parseInt(process.env.VITE_COOLDOWN_HOURS || "1")) * 60 * 60;
  const winPercentageBP = (parseFloat(process.env.VITE_WINNER_PAYOUT_PERCENTAGE || "90")) * 100;
  const housePercentageBP = (parseFloat(process.env.VITE_HOUSE_FEE_PERCENTAGE || "10")) * 100;
  const winChanceBP = (parseFloat(process.env.VITE_WIN_PERCENTAGE || "1")) * 100;
  const maxRecentWinners = parseInt(process.env.VITE_RECENT_WINNERS_LIMIT || "100");
  const minPotSize = shotCost; // Minimum pot size same as shot cost
  
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

  // Update existing .env file with new contract address
  const envPath = path.join(process.cwd(), '.env');
  
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update or add VITE_CONTRACT_ADDRESS
      if (envContent.includes('VITE_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(
          /VITE_CONTRACT_ADDRESS=.*/,
          `VITE_CONTRACT_ADDRESS=${contractAddress}`
        );
      } else {
        envContent += `\n# Smart Contract Address (Updated ${new Date().toISOString()})\nVITE_CONTRACT_ADDRESS=${contractAddress}\n`;
      }
    } else {
      // Create new .env file if it doesn't exist
      envContent = `# ETH Shot Environment Configuration
# Generated on ${new Date().toISOString()}

# Smart Contract Configuration
VITE_CONTRACT_ADDRESS=${contractAddress}
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111

# Game Configuration
VITE_SHOT_COST_ETH=0.001
VITE_SPONSOR_COST_ETH=0.01
VITE_COOLDOWN_HOURS=1
VITE_WINNER_PAYOUT_PERCENTAGE=90
VITE_HOUSE_FEE_PERCENTAGE=10
VITE_WIN_PERCENTAGE=1
VITE_RECENT_WINNERS_LIMIT=100

# Supabase Configuration (Update with your values)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
VITE_APP_URL=https://ethshot.io
NODE_ENV=development
`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`🔧 Environment file updated: ${envPath}`);
    
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
  }
  console.log('\n📋 Next steps:');
  console.log('1. Verify the contract on Etherscan');
  console.log('2. Test all contract functions with the frontend');
  console.log('3. Deploy frontend to Vercel with updated contract address');
  console.log('4. Update DNS settings for ethshot.io');
  
  // Test basic contract functionality
  console.log('\n🧪 Testing basic contract functionality...');
  
  try {
    const currentPot = await ethShot.getCurrentPot();
    console.log(`✅ Current pot: ${ethers.formatEther(currentPot)} ETH`);
    
    const [signer] = await ethers.getSigners();
    const canCommit = await ethShot.canCommitShot(signer.address);
    console.log(`✅ Can commit shot: ${canCommit}`);
    
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