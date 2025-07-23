import pkg from 'hardhat';
const { ethers } = pkg;
import 'dotenv/config';

async function main() {
  console.log('🚀 Starting ETH Shot contract deployment...\n');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deploying contracts with account:', deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Get commission address from environment or use deployer as fallback
  const commissionAddress = process.env.HOUSE_COMMISSION_ADDRESS || deployer.address;
  
  if (process.env.HOUSE_COMMISSION_ADDRESS) {
    console.log('🏦 House commission address (from env):', commissionAddress);
  } else {
    console.log('🏦 House commission address (deployer):', commissionAddress);
    console.log('⚠️  Set HOUSE_COMMISSION_ADDRESS in .env to use a different address\n');
  }

  // Validate commission address
  if (!ethers.isAddress(commissionAddress)) {
    throw new Error(`Invalid commission address: ${commissionAddress}`);
  }

  // Get the contract factory
  const EthShot = await ethers.getContractFactory('EthShot');

  // Contract configuration parameters
  const shotCost = ethers.parseEther('0.0005'); // 0.0005 ETH per shot
  const sponsorCost = ethers.parseEther('0.001'); // 0.001 ETH per sponsorship
  const cooldownPeriod = 3600; // 1 hour in seconds
  const winPercentage = 90; // 90% to winner
  const housePercentage = 10; // 10% to house
  const winChance = 1; // 1% chance to win

  console.log('📋 Contract Configuration:');
  console.log('💸 Shot cost:', ethers.formatEther(shotCost), 'ETH');
  console.log('🎯 Sponsor cost:', ethers.formatEther(sponsorCost), 'ETH');
  console.log('⏰ Cooldown period:', cooldownPeriod, 'seconds');
  console.log('🎲 Win chance:', winChance, '%');
  console.log('💰 Winner percentage:', winPercentage, '%');
  console.log('🏠 House percentage:', housePercentage, '%\n');

  // Deploy the contract with all required parameters
  console.log('⏳ Deploying EthShot contract...');
  const ethShot = await EthShot.deploy(
    commissionAddress,
    shotCost,
    sponsorCost,
    cooldownPeriod,
    winPercentage,
    housePercentage,
    winChance
  );

  // Wait for deployment to complete
  await ethShot.waitForDeployment();
  const contractAddress = await ethShot.getAddress();
  
  // Get deployment transaction details
  const deploymentTx = ethShot.deploymentTransaction();
  const txHash = deploymentTx.hash;
  const blockNumber = deploymentTx.blockNumber;

  console.log('✅ EthShot contract deployed successfully!');
  console.log('📍 Contract address:', contractAddress);
  console.log('🔗 Transaction hash:', txHash);
  console.log('📦 Block number:', blockNumber);
  console.log('🏠 Owner/Commission address:', commissionAddress);

  // Verify contract constants
  const deployedShotCost = await ethShot.SHOT_COST();
  const deployedSponsorCost = await ethShot.SPONSOR_COST();
  const deployedCooldownPeriod = await ethShot.COOLDOWN_PERIOD();

  console.log('\n📊 Deployed Contract Configuration:');
  console.log('💸 Shot cost:', ethers.formatEther(deployedShotCost), 'ETH');
  console.log('🎯 Sponsor cost:', ethers.formatEther(deployedSponsorCost), 'ETH');
  console.log('⏰ Cooldown period:', deployedCooldownPeriod.toString(), 'seconds');

  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log('\n🌐 Network Information:');
  console.log('🔗 Network name:', network.name);
  console.log('🆔 Chain ID:', network.chainId.toString());

  // Save deployment information
  const deploymentInfo = {
    contractAddress,
    transactionHash: txHash,
    blockNumber: blockNumber,
    ownerAddress: commissionAddress,
    commissionAddress: commissionAddress,
    deployerAddress: deployer.address,
    network: network.name,
    chainId: network.chainId.toString(),
    deploymentTime: new Date().toISOString(),
    shotCost: ethers.formatEther(deployedShotCost),
    sponsorCost: ethers.formatEther(deployedSponsorCost),
    cooldownPeriod: deployedCooldownPeriod.toString(),
  };

  console.log('\n💾 Deployment completed successfully!');
  console.log('📋 Save this information for your frontend configuration:');
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verification instructions
  console.log('\n🔍 To verify the contract on Etherscan, run:');
  console.log(`npx hardhat verify --network ${network.name} ${contractAddress} "${commissionAddress}"`);
  
  // Transaction hash usage information
  console.log('\n📋 Transaction Hash Usage:');
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${txHash}`);
  console.log('📊 Use the transaction hash to:');
  console.log('   • Verify deployment on blockchain explorers');
  console.log('   • Track gas usage and transaction details');
  console.log('   • Provide proof of deployment for audits');
  console.log('   • Debug deployment issues if they occur');

  return deploymentInfo;
}

// Handle deployment errors
main()
  .then(deploymentInfo => {
    console.log('\n🎉 Deployment script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });