/**
 * Debug Authentication Status
 * 
 * This script helps debug authentication issues by checking the current
 * Supabase session and authentication status.
 */

import { supabase } from './lib/database/client.js';
import { getAuthStatus, getCurrentSession, isAuthenticated } from './lib/utils/wallet-auth.js';

async function debugAuth() {
  console.log('🔍 Debug Authentication Status');
  console.log('================================');
  
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.error('❌ Supabase client not configured');
      return;
    }
    
    console.log('✅ Supabase client is configured');
    
    // Get current session
    const session = await getCurrentSession();
    console.log('\n📋 Current Session:');
    if (session) {
      console.log('✅ Session exists');
      console.log('  - User ID:', session.user?.id);
      console.log('  - Email:', session.user?.email);
      console.log('  - Expires at:', new Date(session.expires_at * 1000).toISOString());
      console.log('  - Is expired:', new Date(session.expires_at * 1000) < new Date());
      console.log('  - User metadata:', session.user?.user_metadata);
    } else {
      console.log('❌ No session found');
    }
    
    // Check authentication status
    const isAuth = await isAuthenticated();
    console.log('\n🔐 Authentication Status:');
    console.log('  - Is authenticated:', isAuth);
    
    // Get detailed auth status
    const authStatus = await getAuthStatus();
    console.log('\n📊 Detailed Auth Status:');
    console.log(JSON.stringify(authStatus, null, 2));
    
    // Test the secure function call
    console.log('\n🧪 Testing secure function call...');
    try {
      const { data, error } = await supabase.rpc('upsert_user_profile_secure', {
        p_nickname: 'test-debug',
        p_avatar_url: null,
        p_bio: 'Debug test',
        p_notifications_enabled: true
      });
      
      if (error) {
        console.error('❌ Secure function error:', error);
      } else {
        console.log('✅ Secure function call successful:', data);
      }
    } catch (error) {
      console.error('❌ Secure function call failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run debug if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugAuth();
}

export { debugAuth };