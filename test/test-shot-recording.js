// Test script to simulate a shot being taken and verify database recording
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

console.log('🧪 Testing Shot Recording Process...\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Simulate the exact same process as the takeShot() function
async function simulateShot() {
  const testWallet = {
    address: '0x1234567890123456789012345678901234567890'
  };
  
  const shotCost = '0.0005'; // ETH
  const txHash = `0xtest_shot_${Date.now()}`;
  const blockNumber = 12345678;
  const won = false;
  
  console.log('📝 Simulating shot recording with data:', {
    playerAddress: testWallet.address,
    amount: shotCost,
    won,
    txHash,
    blockNumber
  });

  try {
    // Step 1: Record the shot
    console.log('\n🎯 Step 1: Recording shot...');
    const { data: shotRecord, error: shotError } = await supabase
      .from('shots')
      .insert({
        player_address: testWallet.address.toLowerCase(),
        amount: shotCost,
        won: won,
        tx_hash: txHash,
        block_number: blockNumber,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (shotError) {
      console.error('❌ Shot recording failed:', shotError);
      return false;
    }
    
    console.log('✅ Shot recorded successfully:', shotRecord.id);

    // Step 2: Get existing player data
    console.log('\n👤 Step 2: Getting existing player data...');
    const { data: existingPlayer, error: playerGetError } = await supabase
      .from('players')
      .select('*')
      .eq('address', testWallet.address.toLowerCase())
      .limit(1);

    if (playerGetError) {
      console.error('❌ Error getting player:', playerGetError);
      return false;
    }

    const player = existingPlayer && existingPlayer.length > 0 ? existingPlayer[0] : null;
    console.log('👤 Existing player data:', player);

    // Step 3: Calculate new player stats
    const newTotalShots = (player?.total_shots || 0) + 1;
    const newTotalSpent = parseFloat(player?.total_spent || '0') + parseFloat(shotCost);
    const newTotalWon = parseFloat(player?.total_won || '0'); // No win in this test

    const playerData = {
      address: testWallet.address.toLowerCase(),
      total_shots: newTotalShots,
      total_spent: newTotalSpent.toString(),
      total_won: newTotalWon.toString(),
      last_shot_time: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('\n👤 Step 3: Upserting player with data:', playerData);

    // Step 4: Upsert player record
    const { data: playerRecord, error: playerError } = await supabase
      .from('players')
      .upsert(playerData, {
        onConflict: 'address'
      })
      .select()
      .single();

    if (playerError) {
      console.error('❌ Player upsert failed:', playerError);
      return false;
    }

    console.log('✅ Player record updated successfully:', playerRecord.address);

    // Step 5: Verify the data is in the database
    console.log('\n🔍 Step 5: Verifying data in database...');
    
    const { data: verifyShots } = await supabase
      .from('shots')
      .select('*')
      .eq('tx_hash', txHash);
    
    const { data: verifyPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('address', testWallet.address.toLowerCase());

    console.log('✅ Shot verification:', verifyShots?.length > 0 ? 'FOUND' : 'NOT FOUND');
    console.log('✅ Player verification:', verifyPlayers?.length > 0 ? 'FOUND' : 'NOT FOUND');

    if (verifyPlayers?.length > 0) {
      console.log('📊 Player stats:', {
        total_shots: verifyPlayers[0].total_shots,
        total_spent: verifyPlayers[0].total_spent,
        total_won: verifyPlayers[0].total_won
      });
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('shots').delete().eq('tx_hash', txHash);
    await supabase.from('players').delete().eq('address', testWallet.address.toLowerCase());
    console.log('✅ Test data cleaned up');

    return true;

  } catch (error) {
    console.error('❌ Simulation failed:', error);
    return false;
  }
}

// Run the simulation
simulateShot()
  .then(success => {
    console.log('\n📋 SIMULATION RESULT:');
    console.log('='.repeat(50));
    if (success) {
      console.log('✅ Shot recording process works correctly!');
      console.log('✅ The issue is likely in the browser-side wallet integration.');
      console.log('✅ Database operations are functioning properly.');
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Test with a real wallet connection');
      console.log('   2. Check browser console for errors during shot taking');
      console.log('   3. Verify the enhanced logging shows detailed error info');
    } else {
      console.log('❌ Shot recording process has issues!');
      console.log('❌ Database operations are failing.');
    }
  })
  .catch(console.error);