// Test script to verify Supabase connectivity and check database data
// Standalone version that doesn't depend on SvelteKit modules
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase configuration from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection and Database Data...');
console.log('📍 Supabase URL:', supabaseUrl);
console.log('🔑 Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 20)}...` : 'NOT SET');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration missing!');
  console.error('   Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database table names (matching the schema)
const TABLES = {
  PLAYERS: 'players',
  SHOTS: 'shots',
  WINNERS: 'winners',
  SPONSORS: 'sponsors',
  GAME_STATS: 'game_stats',
};

async function testDatabaseConnection() {
  try {
    console.log('\n🔗 Testing database connection...');
    
    // Test basic connectivity by counting players
    const { count, error } = await supabase
      .from(TABLES.PLAYERS)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
    
    console.log('✅ Database connection successful!');
    console.log(`📊 Players table accessible with ${count || 0} records`);
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
}

async function checkTableData() {
  try {
    console.log('\n📊 Checking table data...');
    
    // Check players table
    const { data: players, error: playersError } = await supabase
      .from(TABLES.PLAYERS)
      .select('*')
      .order('total_shots', { ascending: false })
      .limit(5);
    
    if (playersError) {
      console.error('❌ Error fetching players:', playersError);
    } else {
      console.log(`👥 Players table: ${players.length} records`);
      if (players.length > 0) {
        console.log('   Top player:', {
          address: players[0].address,
          total_shots: players[0].total_shots,
          total_spent: players[0].total_spent,
          total_won: players[0].total_won
        });
      }
    }
    
    // Check shots table
    const { data: shots, error: shotsError } = await supabase
      .from(TABLES.SHOTS)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (shotsError) {
      console.error('❌ Error fetching shots:', shotsError);
    } else {
      console.log(`🎯 Shots table: ${shots.length} records`);
      if (shots.length > 0) {
        console.log('   Recent shot:', {
          player_address: shots[0].player_address,
          amount: shots[0].amount,
          won: shots[0].won,
          timestamp: shots[0].timestamp
        });
      }
    }
    
    // Check winners table
    const { data: winners, error: winnersError } = await supabase
      .from(TABLES.WINNERS)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (winnersError) {
      console.error('❌ Error fetching winners:', winnersError);
    } else {
      console.log(`🏆 Winners table: ${winners.length} records`);
      if (winners.length > 0) {
        console.log('   Recent winner:', {
          winner_address: winners[0].winner_address,
          amount: winners[0].amount,
          timestamp: winners[0].timestamp
        });
      }
    }
    
    // Check game stats table
    const { data: gameStats, error: gameStatsError } = await supabase
      .from(TABLES.GAME_STATS)
      .select('*')
      .limit(1);
    
    if (gameStatsError) {
      console.error('❌ Error fetching game stats:', gameStatsError);
    } else {
      console.log(`📈 Game stats table: ${gameStats.length} records`);
      if (gameStats.length > 0) {
        console.log('   Current stats:', {
          total_shots: gameStats[0].total_shots,
          total_players: gameStats[0].total_players,
          total_pot_won: gameStats[0].total_pot_won,
          current_pot: gameStats[0].current_pot
        });
      }
    }
    
    return {
      players: players?.length || 0,
      shots: shots?.length || 0,
      winners: winners?.length || 0,
      hasGameStats: gameStats?.length > 0
    };
  } catch (error) {
    console.error('❌ Error checking table data:', error);
    return null;
  }
}

async function testDataInsertion() {
  try {
    console.log('\n🧪 Testing data insertion (test record)...');
    
    const testAddress = '0xtest1234567890123456789012345678901234567890';
    const testAmount = '0.001';
    const testTxHash = `0xtest${Date.now()}`;
    
    // Test shot recording
    const { data: shotResult, error: shotError } = await supabase
      .from(TABLES.SHOTS)
      .insert({
        player_address: testAddress.toLowerCase(),
        amount: testAmount,
        won: false,
        tx_hash: testTxHash,
        block_number: 12345,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    
    if (shotError) {
      console.error('❌ Shot recording failed:', shotError);
      return false;
    }
    
    console.log('✅ Shot recording successful:', shotResult.id);
    
    // Test player upsert
    const { data: playerResult, error: playerError } = await supabase
      .from(TABLES.PLAYERS)
      .upsert({
        address: testAddress.toLowerCase(),
        total_shots: 1,
        total_spent: testAmount,
        total_won: '0',
        last_shot_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'address'
      })
      .select()
      .single();
    
    if (playerError) {
      console.error('❌ Player upsert failed:', playerError);
      return false;
    }
    
    console.log('✅ Player upsert successful:', playerResult.address);
    
    // Clean up test data
    await supabase.from(TABLES.SHOTS).delete().eq('tx_hash', testTxHash);
    await supabase.from(TABLES.PLAYERS).delete().eq('address', testAddress.toLowerCase());
    console.log('🧹 Test data cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Data insertion test failed:', error);
    return false;
  }
}

async function runDiagnostics() {
  console.log('🚀 Starting ETH Shot Database Diagnostics...\n');
  
  // Test 1: Database connectivity
  const connectionOk = await testDatabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ Database connection failed. Check your Supabase configuration.');
    return;
  }
  
  // Test 2: Check existing data
  const dataStats = await checkTableData();
  if (!dataStats) {
    console.log('\n❌ Failed to check table data.');
    return;
  }
  
  // Test 3: Test data insertion
  const insertionOk = await testDataInsertion();
  
  // Summary
  console.log('\n📋 DIAGNOSTIC SUMMARY:');
  console.log('='.repeat(50));
  console.log(`✅ Database Connection: ${connectionOk ? 'OK' : 'FAILED'}`);
  console.log(`📊 Players in DB: ${dataStats.players}`);
  console.log(`🎯 Shots in DB: ${dataStats.shots}`);
  console.log(`🏆 Winners in DB: ${dataStats.winners}`);
  console.log(`📈 Game Stats: ${dataStats.hasGameStats ? 'Present' : 'Missing'}`);
  console.log(`🧪 Data Insertion: ${insertionOk ? 'OK' : 'FAILED'}`);
  
  if (dataStats.players === 0 && dataStats.shots === 0) {
    console.log('\n🔍 ISSUE IDENTIFIED:');
    console.log('   ❌ No players or shots found in database.');
    console.log('   ❌ This explains why the leaderboard is empty.');
    console.log('   ❌ The takeShot() function is not recording data properly.');
  } else if (dataStats.players > 0) {
    console.log('\n✅ DATA FOUND:');
    console.log('   ✅ Players and shots exist in database.');
    console.log('   ✅ The issue may be in the leaderboard component logic.');
  }
  
  console.log('\n💡 NEXT STEPS:');
  if (dataStats.shots === 0) {
    console.log('   1. ❗ Check if shots are being recorded when takeShot() is called');
    console.log('   2. ❗ Verify Supabase RLS policies allow data insertion');
    console.log('   3. ❗ Check browser console for database errors during shot taking');
    console.log('   4. ❗ Test the takeShot() function in the browser');
  } else {
    console.log('   1. ✅ Data is being recorded - check leaderboard component logic');
    console.log('   2. ✅ Verify leaderboard is fetching from correct table/view');
    console.log('   3. ✅ Check if leaderboard component is properly loading data');
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);