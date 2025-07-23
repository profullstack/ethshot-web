import { ethers } from 'hardhat';
import 'dotenv/config';

async function main() {
  console.log('🚀 Starting ETH Shot contract deployment...\n');

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deploying contracts with account:', deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Get the contract factory
  const EthShot = await ethers.getContractFactory('EthShot');

  // Deploy the contract
  console.log('⏳ Deploying EthShot contract...');
  const ethShot = await EthShot.deploy(deployer.address);

  // Wait for deployment to complete
  await ethShot.waitForDeployment();
  const contractAddress = await ethShot.getAddress();

  console.log('✅ EthShot contract deployed successfully!');
  console.log('📍 Contract address:', contractAddress);
  console.log('🏠 Owner address:', deployer.address);

  // Verify contract constants
  const shotCost = await ethShot.SHOT_COST();
  const sponsorCost = await ethShot.SPONSOR_COST();
  const cooldownPeriod = await ethShot.COOLDOWN_PERIOD();

  console.log('\n📊 Contract Configuration:');
  console.log('💸 Shot cost:', ethers.formatEther(shotCost), 'ETH');
  console.log('🎯 Sponsor cost:', ethers.formatEther(sponsorCost), 'ETH');
  console.log('⏰ Cooldown period:', cooldownPeriod.toString(), 'seconds');

  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log('\n🌐 Network Information:');
  console.log('🔗 Network name:', network.name);
  console.log('🆔 Chain ID:', network.chainId.toString());

  // Save deployment information
  const deploymentInfo = {
    contractAddress,
    ownerAddress: deployer.address,
    network: network.name,
    chainId: network.chainId.toString(),
    deploymentTime: new Date().toISOString(),
    shotCost: ethers.formatEther(shotCost),
    sponsorCost: ethers.formatEther(sponsorCost),
    cooldownPeriod: cooldownPeriod.toString(),
  };

  console.log('\n💾 Deployment completed successfully!');
  console.log('📋 Save this information for your frontend configuration:');
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verification instructions
  console.log('\n🔍 To verify the contract on Etherscan, run:');
  console.log(`npx hardhat verify --network ${network.name} ${contractAddress} "${deployer.address}"`);

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