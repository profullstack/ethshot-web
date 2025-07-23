import { ethers } from 'ethers';
import { NETWORK_CONFIG } from './src/lib/config.js';

// ETH Shot contract ABI (key functions for debugging)
const ETH_SHOT_ABI = [
  'function takeShot() external payable',
  'function sponsorRound(string calldata name, string calldata logoUrl) external payable',
  'function getCurrentPot() external view returns (uint256)',
  'function getContractBalance() external view returns (uint256)',
  'function getHouseFunds() external view returns (uint256)',
  'function SHOT_COST() external view returns (uint256)',
  'function SPONSOR_COST() external view returns (uint256)',
  'event ShotTaken(address indexed player, uint256 amount, bool won)',
  'event SponsorshipActivated(address indexed sponsor, string name, string logoUrl)',
];

async function debugContractState() {
  console.log('🔍 ETH Shot Contract Debug Tool');
  console.log('================================');
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.RPC_URL);
    console.log(`📡 Connected to: ${NETWORK_CONFIG.RPC_URL}`);
    
    // Create contract instance
    const contract = new ethers.Contract(NETWORK_CONFIG.CONTRACT_ADDRESS, ETH_SHOT_ABI, provider);
    console.log(`📄 Contract: ${NETWORK_CONFIG.CONTRACT_ADDRESS}`);
    
    // Check if contract exists
    const code = await provider.getCode(NETWORK_CONFIG.CONTRACT_ADDRESS);
    if (code === '0x') {
      console.log('❌ Contract not deployed at this address!');
      return;
    }
    console.log('✅ Contract exists');
    
    // Get contract state
    console.log('\n📊 Contract State:');
    console.log('==================');
    
    const [contractBalance, houseFunds, currentPot, shotCost, sponsorCost] = await Promise.all([
      contract.getContractBalance(),
      contract.getHouseFunds(),
      contract.getCurrentPot(),
      contract.SHOT_COST(),
      contract.SPONSOR_COST()
    ]);
    
    console.log(`💰 Contract Balance: ${ethers.formatEther(contractBalance)} ETH (${contractBalance.toString()} wei)`);
    console.log(`🏠 House Funds: ${ethers.formatEther(houseFunds)} ETH (${houseFunds.toString()} wei)`);
    console.log(`🎯 Current Pot: ${ethers.formatEther(currentPot)} ETH (${currentPot.toString()} wei)`);
    console.log(`💸 Shot Cost: ${ethers.formatEther(shotCost)} ETH (${shotCost.toString()} wei)`);
    console.log(`💸 Sponsor Cost: ${ethers.formatEther(sponsorCost)} ETH (${sponsorCost.toString()} wei)`);
    
    // Calculate expected pot
    const calculatedPot = contractBalance - houseFunds;
    console.log(`🧮 Calculated Pot (balance - house): ${ethers.formatEther(calculatedPot)} ETH`);
    
    // Check if calculated pot matches contract pot
    if (calculatedPot.toString() === currentPot.toString()) {
      console.log('✅ Pot calculation matches contract');
    } else {
      console.log('⚠️  Pot calculation mismatch!');
    }
    
    // Get recent events
    console.log('\n📜 Recent Events:');
    console.log('=================');
    
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 1000); // Last 1000 blocks
    
    try {
      const shotEvents = await contract.queryFilter('ShotTaken', fromBlock);
      const sponsorEvents = await contract.queryFilter('SponsorshipActivated', fromBlock);
      
      console.log(`🎯 Shot Events (last 1000 blocks): ${shotEvents.length}`);
      shotEvents.slice(-5).forEach((event, i) => {
        console.log(`  ${i + 1}. Block ${event.blockNumber}: ${event.args.player} - ${ethers.formatEther(event.args.amount)} ETH - Won: ${event.args.won}`);
      });
      
      console.log(`🎪 Sponsor Events (last 1000 blocks): ${sponsorEvents.length}`);
      sponsorEvents.slice(-5).forEach((event, i) => {
        console.log(`  ${i + 1}. Block ${event.blockNumber}: ${event.args.sponsor} - "${event.args.name}"`);
      });
      
    } catch (eventError) {
      console.log('⚠️  Could not fetch events:', eventError.message);
    }
    
    // Test gas estimation
    console.log('\n⛽ Gas Estimation Tests:');
    console.log('=======================');
    
    try {
      // Create a dummy signer for gas estimation (won't actually send)
      const wallet = ethers.Wallet.createRandom();
      const contractWithSigner = contract.connect(wallet);
      
      // Estimate takeShot gas
      try {
        const shotGas = await contractWithSigner.takeShot.estimateGas({
          value: shotCost
        });
        console.log(`🎯 takeShot gas estimate: ${shotGas.toString()}`);
      } catch (shotGasError) {
        console.log(`❌ takeShot gas estimation failed: ${shotGasError.message}`);
      }
      
      // Estimate sponsorRound gas
      try {
        const sponsorGas = await contractWithSigner.sponsorRound.estimateGas('Test Sponsor', 'https://example.com/logo.png', {
          value: sponsorCost
        });
        console.log(`🎪 sponsorRound gas estimate: ${sponsorGas.toString()}`);
      } catch (sponsorGasError) {
        console.log(`❌ sponsorRound gas estimation failed: ${sponsorGasError.message}`);
      }
      
    } catch (gasError) {
      console.log(`❌ Gas estimation setup failed: ${gasError.message}`);
    }
    
    // Network info
    console.log('\n🌐 Network Info:');
    console.log('================');
    const network = await provider.getNetwork();
    const feeData = await provider.getFeeData();
    
    console.log(`Chain ID: ${network.chainId}`);
    console.log(`Network Name: ${network.name}`);
    console.log(`Gas Price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'N/A'}`);
    console.log(`Max Fee Per Gas: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugContractState().catch(console.error);