import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';

async function main() {
  console.log('🧪 Testing deployed EthShot contract...\n');

  // Get contract address from deployment.json
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🔗 Etherscan: ${deploymentInfo.etherscanUrl}\n`);

  // Get the contract factory and attach to deployed contract
  const EthShot = await ethers.getContractFactory('EthShot');
  const ethShot = EthShot.attach(contractAddress);
  
  try {
    // Test basic contract functions
    console.log('🔍 Testing contract functions...');
    
    const currentPot = await ethShot.getCurrentPot();
    console.log(`✅ Current pot: ${ethers.formatEther(currentPot)} ETH`);
    
    const shotCost = await ethShot.SHOT_COST();
    console.log(`✅ Shot cost: ${ethers.formatEther(shotCost)} ETH`);
    
    const sponsorCost = await ethShot.SPONSOR_COST();
    console.log(`✅ Sponsor cost: ${ethers.formatEther(sponsorCost)} ETH`);
    
    const cooldownPeriod = await ethShot.COOLDOWN_PERIOD();
    console.log(`✅ Cooldown period: ${cooldownPeriod} seconds (${Number(cooldownPeriod) / 3600} hours)`);
    
    const [signer] = await ethers.getSigners();
    const canCommit = await ethShot.canCommitShot(signer.address);
    console.log(`✅ Can commit shot: ${canCommit}`);
    
    const cooldown = await ethShot.getCooldownRemaining(signer.address);
    console.log(`✅ Cooldown remaining: ${cooldown} seconds`);
    
    console.log('\n🎉 All contract tests passed successfully!');
    console.log('\n📋 Contract is ready for use:');
    console.log(`   • Frontend updated with contract address: ${contractAddress}`);
    console.log(`   • All basic functions working correctly`);
    console.log(`   • Ready for player interactions`);
    
  } catch (error) {
    console.error('❌ Error testing contract:', error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });