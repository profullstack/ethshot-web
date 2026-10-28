import { ethers } from 'ethers';
import 'dotenv/config';
import { deployerKey } from './lib/deployer-key.js';

async function checkAddresses() {
  console.log('🔍 Checking deployment addresses...\n');

  // The deployer key comes from the logicsrc keyring or a prompt, never env.
  try {
    const wallet = new ethers.Wallet(deployerKey());
    console.log('👤 Deployer Address:');
    console.log(`   ${wallet.address}`);
    console.log('   → This address deploys the contract and pays gas fees\n');

    // Check house commission address
    const houseAddress = process.env.HOUSE_COMMISSION_ADDRESS;
    if (houseAddress) {
      console.log('🏠 House Commission Address (from HOUSE_COMMISSION_ADDRESS):');
      console.log(`   ${houseAddress}`);
      console.log('   → This address receives house fees from the game\n');
    } else {
      console.log('🏠 House Commission Address: Not set');
      console.log('   → Will default to deployer address\n');
    }

    // Contract owner is always the deployer (for admin privileges)
    const contractOwner = wallet.address;
    console.log('👑 Contract Owner (who can access AdminPanel):');
    console.log(`   ${contractOwner}`);
    console.log('   → This address has admin privileges on the contract');
    console.log('   → Make sure this matches your connected wallet to see AdminPanel\n');

    // Summary
    console.log('📋 Summary:');
    console.log(`   Deployer: ${wallet.address} (also contract owner)`);
    console.log(`   House: ${houseAddress || 'Same as deployer'} (receives fees)`);
    console.log(`   Owner: ${contractOwner} (admin privileges)`);

  } catch (error) {
    console.log('❌ Invalid private key format');
  }
}

checkAddresses();