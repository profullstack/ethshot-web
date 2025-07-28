import { ethers } from 'ethers';
import 'dotenv/config';

async function checkAddresses() {
  console.log('🔍 Checking deployment addresses...\n');

  // Check deployer address (from PRIVATE_KEY)
  if (!process.env.PRIVATE_KEY) {
    console.log('❌ No PRIVATE_KEY found in .env file');
    return;
  }

  try {
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    console.log('👤 Deployer Address (from PRIVATE_KEY):');
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

    // Determine contract owner
    const contractOwner = houseAddress || wallet.address;
    console.log('👑 Contract Owner (who can access AdminPanel):');
    console.log(`   ${contractOwner}`);
    console.log('   → This address has admin privileges on the contract');
    console.log('   → Make sure this matches your connected wallet to see AdminPanel\n');

    // Summary
    console.log('📋 Summary:');
    console.log(`   Deployer: ${wallet.address}`);
    console.log(`   House: ${houseAddress || 'Same as deployer'}`);
    console.log(`   Owner: ${contractOwner}`);

  } catch (error) {
    console.log('❌ Invalid private key format');
  }
}

checkAddresses();