import pkg from 'hardhat';
const { ethers } = pkg;
import fs from 'fs';

async function main() {
  console.log('🔍 Checking contract deployment...\n');

  // Get contract address from deployment.json
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment.json', 'utf8'));
  const contractAddress = deploymentInfo.contractAddress;
  
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🔗 Etherscan: ${deploymentInfo.etherscanUrl}\n`);

  // Check if there's code at the address
  const provider = ethers.provider;
  const code = await provider.getCode(contractAddress);
  
  console.log(`📝 Contract bytecode length: ${code.length} characters`);
  console.log(`📝 Contract bytecode preview: ${code.substring(0, 100)}...`);
  
  if (code === '0x') {
    console.log('❌ No contract found at this address!');
    console.log('   This means either:');
    console.log('   1. The contract was never deployed');
    console.log('   2. The deployment failed');
    console.log('   3. The address is incorrect');
    return;
  }
  
  console.log('✅ Contract bytecode found at address');
  
  // Try to get the contract factory and check if it matches
  try {
    const EthShot = await ethers.getContractFactory('EthShot');
    const expectedBytecode = EthShot.bytecode;
    
    console.log(`\n📋 Expected bytecode length: ${expectedBytecode.length} characters`);
    console.log(`📋 Expected bytecode preview: ${expectedBytecode.substring(0, 100)}...`);
    
    // Compare the deployed bytecode with expected (note: deployed bytecode is runtime code)
    const deployedBytecode = EthShot.interface.format();
    console.log(`\n🔄 Contract interface methods: ${deployedBytecode.length} functions`);
    
    // Try a simple call to see if the interface matches
    const ethShot = EthShot.attach(contractAddress);
    
    // Test the most basic constant first
    console.log('\n🧪 Testing basic contract calls...');
    
    try {
      const shotCost = await ethShot.SHOT_COST();
      console.log(`✅ SHOT_COST: ${ethers.formatEther(shotCost)} ETH`);
    } catch (error) {
      console.log(`❌ SHOT_COST failed: ${error.message}`);
    }
    
    try {
      const cooldown = await ethShot.COOLDOWN_PERIOD();
      console.log(`✅ COOLDOWN_PERIOD: ${cooldown} seconds`);
    } catch (error) {
      console.log(`❌ COOLDOWN_PERIOD failed: ${error.message}`);
    }
    
    try {
      const currentPot = await ethShot.getCurrentPot();
      console.log(`✅ getCurrentPot: ${ethers.formatEther(currentPot)} ETH`);
    } catch (error) {
      console.log(`❌ getCurrentPot failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking contract:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });