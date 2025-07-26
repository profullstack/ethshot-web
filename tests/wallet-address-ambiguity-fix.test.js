// Test to verify wallet_address ambiguity fix
// This test ensures the upsert_user_profile function works without column ambiguity errors

import { createClient } from '@supabase/supabase-js';
import { expect } from 'chai';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Wallet Address Ambiguity Fix', () => {
  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const testNickname = 'TestUser';
  const testBio = 'Test bio';

  beforeEach(async () => {
    // Clean up any existing test data
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWalletAddress.toLowerCase());
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('user_profiles')
      .delete()
      .eq('wallet_address', testWalletAddress.toLowerCase());
  });

  it('should create a new user profile without wallet_address ambiguity error', async () => {
    const { data, error } = await supabase.rpc('upsert_user_profile', {
      input_wallet_address: testWalletAddress,
      input_nickname: testNickname,
      input_bio: testBio,
      input_notifications_enabled: true
    });

    expect(error).to.be.null;
    expect(data).to.be.an('array');
    expect(data).to.have.length(1);
    expect(data[0].wallet_address).to.equal(testWalletAddress.toLowerCase());
    expect(data[0].nickname).to.equal(testNickname);
    expect(data[0].bio).to.equal(testBio);
    expect(data[0].notifications_enabled).to.be.true;
  });

  it('should update an existing user profile without wallet_address ambiguity error', async () => {
    // First create a profile
    await supabase.rpc('upsert_user_profile', {
      input_wallet_address: testWalletAddress,
      input_nickname: testNickname,
      input_bio: testBio,
      input_notifications_enabled: true
    });

    // Then update it
    const updatedNickname = 'UpdatedTestUser';
    const updatedBio = 'Updated test bio';

    const { data, error } = await supabase.rpc('upsert_user_profile', {
      input_wallet_address: testWalletAddress,
      input_nickname: updatedNickname,
      input_bio: updatedBio,
      input_notifications_enabled: false
    });

    expect(error).to.be.null;
    expect(data).to.be.an('array');
    expect(data).to.have.length(1);
    expect(data[0].wallet_address).to.equal(testWalletAddress.toLowerCase());
    expect(data[0].nickname).to.equal(updatedNickname);
    expect(data[0].bio).to.equal(updatedBio);
    expect(data[0].notifications_enabled).to.be.false;
  });

  it('should get user profile without wallet_address ambiguity error', async () => {
    // First create a profile
    await supabase.rpc('upsert_user_profile', {
      input_wallet_address: testWalletAddress,
      input_nickname: testNickname,
      input_bio: testBio,
      input_notifications_enabled: true
    });

    // Then get it
    const { data, error } = await supabase.rpc('get_user_profile', {
      input_wallet_address: testWalletAddress
    });

    expect(error).to.be.null;
    expect(data).to.be.an('array');
    expect(data).to.have.length(1);
    expect(data[0].wallet_address).to.equal(testWalletAddress.toLowerCase());
    expect(data[0].nickname).to.equal(testNickname);
    expect(data[0].bio).to.equal(testBio);
  });

  it('should check nickname availability without wallet_address ambiguity error', async () => {
    // First create a profile with a nickname
    await supabase.rpc('upsert_user_profile', {
      input_wallet_address: testWalletAddress,
      input_nickname: testNickname,
      input_bio: testBio,
      input_notifications_enabled: true
    });

    // Check if the same nickname is available (should be false)
    const { data: unavailable, error: error1 } = await supabase.rpc('is_nickname_available', {
      input_nickname: testNickname
    });

    expect(error1).to.be.null;
    expect(unavailable).to.be.false;

    // Check if a different nickname is available (should be true)
    const { data: available, error: error2 } = await supabase.rpc('is_nickname_available', {
      input_nickname: 'DifferentNickname'
    });

    expect(error2).to.be.null;
    expect(available).to.be.true;

    // Check if the same nickname is available excluding the current wallet (should be true)
    const { data: availableExcluding, error: error3 } = await supabase.rpc('is_nickname_available', {
      input_nickname: testNickname,
      exclude_wallet_address: testWalletAddress
    });

    expect(error3).to.be.null;
    expect(availableExcluding).to.be.true;
  });
});