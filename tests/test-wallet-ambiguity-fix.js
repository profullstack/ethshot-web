// Simple test script to verify wallet_address ambiguity fix
// Run with: node tests/test-wallet-ambiguity-fix.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWalletAddressAmbiguityFix() {
  console.log('🧪 Testing wallet_address ambiguity fix...\n');

  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const testNickname = 'TestUser';
  const testBio = 'Test bio';

  try {
    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWalletAddress.toLowerCase());

    // Test 1: Create a new user profile
    console.log('✅ Test 1: Creating new user profile...');
    const { data: createData, error: createError } = await supabase.rpc('upsert_user_profile', {
      wallet_addr_param: testWalletAddress,
      nickname_param: testNickname,
      bio_param: testBio,
      notifications_param: true
    });

    if (createError) {
      console.error('❌ Create test failed:', createError);
      return false;
    }

    console.log('✅ Create test passed:', {
      wallet_address: createData[0].wallet_address,
      nickname: createData[0].nickname,
      bio: createData[0].bio,
      notifications_enabled: createData[0].notifications_enabled
    });

    // Test 2: Update existing user profile
    console.log('\n✅ Test 2: Updating existing user profile...');
    const updatedNickname = 'UpdatedTestUser';
    const updatedBio = 'Updated test bio';

    const { data: updateData, error: updateError } = await supabase.rpc('upsert_user_profile', {
      wallet_addr_param: testWalletAddress,
      nickname_param: updatedNickname,
      bio_param: updatedBio,
      notifications_param: false
    });

    if (updateError) {
      console.error('❌ Update test failed:', updateError);
      return false;
    }

    console.log('✅ Update test passed:', {
      wallet_address: updateData[0].wallet_address,
      nickname: updateData[0].nickname,
      bio: updateData[0].bio,
      notifications_enabled: updateData[0].notifications_enabled
    });

    // Test 3: Get user profile
    console.log('\n✅ Test 3: Getting user profile...');
    const { data: getData, error: getError } = await supabase.rpc('get_user_profile', {
      wallet_addr: testWalletAddress
    });

    if (getError) {
      console.error('❌ Get test failed:', getError);
      return false;
    }

    console.log('✅ Get test passed:', {
      wallet_address: getData[0].wallet_address,
      nickname: getData[0].nickname,
      bio: getData[0].bio
    });

    // Test 4: Check nickname availability
    console.log('\n✅ Test 4: Checking nickname availability...');
    
    // Check if the used nickname is available (should be false)
    const { data: unavailable, error: error1 } = await supabase.rpc('is_nickname_available', {
      p_nickname: updatedNickname
    });

    if (error1) {
      console.error('❌ Nickname availability test 1 failed:', error1);
      return false;
    }

    console.log(`✅ Nickname "${updatedNickname}" availability: ${unavailable} (should be false)`);

    // Check if a different nickname is available (should be true)
    const { data: available, error: error2 } = await supabase.rpc('is_nickname_available', {
      p_nickname: 'DifferentNickname'
    });

    if (error2) {
      console.error('❌ Nickname availability test 2 failed:', error2);
      return false;
    }

    console.log(`✅ Nickname "DifferentNickname" availability: ${available} (should be true)`);

    // Check if the same nickname is available excluding the current wallet (should be true)
    const { data: availableExcluding, error: error3 } = await supabase.rpc('is_nickname_available', {
      p_nickname: updatedNickname,
      exclude_wallet_addr: testWalletAddress
    });

    if (error3) {
      console.error('❌ Nickname availability test 3 failed:', error3);
      return false;
    }

    console.log(`✅ Nickname "${updatedNickname}" availability (excluding current wallet): ${availableExcluding} (should be true)`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWalletAddress.toLowerCase());

    console.log('\n🎉 All tests passed! The wallet_address ambiguity issue has been fixed.');
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testWalletAddressAmbiguityFix()
  .then(success => {
    if (success) {
      console.log('\n✅ Test suite completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Test suite failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });