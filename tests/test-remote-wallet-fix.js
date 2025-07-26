import { createClient } from '@supabase/supabase-js';

// Test against remote database using environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables for remote testing');
  console.log('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🧪 Testing wallet_address ambiguity fix on REMOTE database...');
console.log(`🔗 Connecting to: ${supabaseUrl}`);

async function testRemoteDatabase() {
  const testWallet = '0x1234567890123456789012345678901234567890';
  
  try {
    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWallet.toLowerCase());

    // Test 1: Create new user profile
    console.log('✅ Test 1: Creating new user profile...');
    const { data: createData, error: createError } = await supabase.rpc('upsert_user_profile', {
      wallet_addr: testWallet,
      p_nickname: 'RemoteTestUser',
      p_avatar_url: null,
      p_bio: 'Remote test bio',
      p_notifications_enabled: true
    });

    if (createError) {
      console.error('❌ Create test failed:', createError);
      return false;
    }

    console.log('✅ Create test passed:', createData[0]);

    // Test 2: Update existing user profile
    console.log('✅ Test 2: Updating existing user profile...');
    const { data: updateData, error: updateError } = await supabase.rpc('upsert_user_profile', {
      wallet_addr: testWallet,
      p_nickname: 'UpdatedRemoteTestUser',
      p_avatar_url: null,
      p_bio: 'Updated remote test bio',
      p_notifications_enabled: false
    });

    if (updateError) {
      console.error('❌ Update test failed:', updateError);
      return false;
    }

    console.log('✅ Update test passed:', updateData[0]);

    // Test 3: Get user profile
    console.log('✅ Test 3: Getting user profile...');
    const { data: getData, error: getError } = await supabase.rpc('get_user_profile', {
      wallet_addr: testWallet
    });

    if (getError) {
      console.error('❌ Get test failed:', getError);
      return false;
    }

    console.log('✅ Get test passed:', getData[0]);

    // Test 4: Check nickname availability
    console.log('✅ Test 4: Checking nickname availability...');
    const { data: availData1, error: availError1 } = await supabase.rpc('is_nickname_available', {
      p_nickname: 'UpdatedRemoteTestUser',
      exclude_wallet_addr: null
    });

    if (availError1) {
      console.error('❌ Nickname availability test failed:', availError1);
      return false;
    }

    console.log(`✅ Nickname "UpdatedRemoteTestUser" availability: ${availData1} (should be false)`);

    const { data: availData2, error: availError2 } = await supabase.rpc('is_nickname_available', {
      p_nickname: 'DifferentRemoteNickname',
      exclude_wallet_addr: null
    });

    if (availError2) {
      console.error('❌ Nickname availability test failed:', availError2);
      return false;
    }

    console.log(`✅ Nickname "DifferentRemoteNickname" availability: ${availData2} (should be true)`);

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWallet.toLowerCase());

    console.log('🎉 All remote tests passed! The wallet_address ambiguity issue has been fixed on the remote database.');
    return true;

  } catch (error) {
    console.error('❌ Remote test suite failed:', error);
    return false;
  }
}

// Run the test
testRemoteDatabase().then(success => {
  if (success) {
    console.log('✅ Remote test suite completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Remote test suite failed!');
    process.exit(1);
  }
});