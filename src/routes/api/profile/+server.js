/**
 * Server-side Profile API Routes
 * 
 * Handles user profile operations with JWT authentication securely on the server-side.
 * This prevents exposure of sensitive operations and environment variables to the client.
 */

import { json } from '@sveltejs/kit';
import { verifyJWT } from '../../../lib/server/jwt-auth.js';
import { supabaseServer, isSupabaseServerAvailable } from '../../../lib/database/server-client.js';

/**
 * POST /api/profile - Handle profile operations
 * Supports multiple profile operations based on the 'action' parameter
 */
export async function POST({ request }) {
  try {
    const { action, ...params } = await request.json();

    switch (action) {
      case 'upsert':
        return await handleUpsertProfile(request, params);
      
      case 'get':
        return await handleGetProfile(request, params);
      
      case 'check_nickname':
        return await handleCheckNickname(request, params);
      
      default:
        return json(
          { 
            success: false, 
            error: 'Invalid action. Supported actions: upsert, get, check_nickname' 
          }, 
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Profile API error:', error);
    return json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Handle profile upsert with JWT authentication
 */
async function handleUpsertProfile(request, { profileData }) {
  try {
    if (!profileData) {
      return json(
        { success: false, error: 'profileData is required' }, 
        { status: 400 }
      );
    }

    // Validate and extract wallet address from JWT
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        { success: false, error: 'Authorization header required' }, 
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let walletAddress;
    
    try {
      const payload = await verifyJWT(token);
      walletAddress = payload.wallet_address;
      
      if (!walletAddress) {
        return json(
          { success: false, error: 'Invalid token: no wallet address' }, 
          { status: 401 }
        );
      }
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError);
      return json(
        { success: false, error: 'Invalid or expired token' }, 
        { status: 401 }
      );
    }

    // Check if server-side Supabase is available
    if (!isSupabaseServerAvailable()) {
      console.error('❌ Server-side Supabase not configured');
      return json(
        {
          success: false,
          error: 'Server configuration error. Please check environment variables.'
        },
        { status: 500 }
      );
    }

    // Use server-side Supabase client to update profile
    console.log('🔄 Upserting user profile via server API:', {
      walletAddress,
      nickname: profileData.nickname,
      avatar_url: profileData.avatarUrl,
      bio: profileData.bio
    });

    // Use the existing upsert_user_profile function from the user_profiles table
    const { data, error } = await supabaseServer.rpc('upsert_user_profile', {
      wallet_addr: walletAddress.toLowerCase(),
      p_nickname: profileData.nickname || null,
      p_avatar_url: profileData.avatarUrl || null,
      p_bio: profileData.bio || null,
      p_notifications_enabled: profileData.notificationsEnabled ?? true
    });

    if (error) {
      console.error('❌ Supabase profile upsert error:', error);
      return json(
        { 
          success: false, 
          error: 'Failed to update profile',
          message: error.message 
        }, 
        { status: 500 }
      );
    }

    console.log('✅ Profile upserted successfully via server API:', data);
    return json({ 
      success: true, 
      profile: data && data.length > 0 ? data[0] : null 
    });
  } catch (error) {
    console.error('❌ Profile upsert error:', error);
    return json(
      { 
        success: false, 
        error: 'Profile upsert failed',
        message: error.message 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Handle profile retrieval with JWT authentication
 */
async function handleGetProfile(request, { walletAddress }) {
  try {
    // For getting profiles, we can allow public access or require auth
    // For now, let's make it public since profiles are generally viewable
    if (!walletAddress) {
      return json(
        { success: false, error: 'walletAddress is required' }, 
        { status: 400 }
      );
    }

    console.log('🔍 Getting user profile via server API:', { walletAddress });

    // Check if server-side Supabase is available
    if (!isSupabaseServerAvailable()) {
      console.error('❌ Server-side Supabase not configured');
      return json(
        {
          success: false,
          error: 'Server configuration error. Please check environment variables.'
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseServer.rpc('get_user_profile', {
      wallet_addr: walletAddress.toLowerCase()
    });

    if (error) {
      console.error('❌ Supabase profile get error:', error);
      return json(
        { 
          success: false, 
          error: 'Failed to get profile',
          message: error.message 
        }, 
        { status: 500 }
      );
    }

    console.log('✅ Profile retrieved successfully via server API:', data);
    return json({ 
      success: true, 
      profile: data && data.length > 0 ? data[0] : null 
    });
  } catch (error) {
    console.error('❌ Profile get error:', error);
    return json(
      { 
        success: false, 
        error: 'Profile retrieval failed',
        message: error.message 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Handle nickname availability check
 */
async function handleCheckNickname(request, { nickname, excludeWalletAddress }) {
  try {
    if (!nickname) {
      return json(
        { success: false, error: 'nickname is required' }, 
        { status: 400 }
      );
    }

    console.log('🔍 Checking nickname availability via server API:', {
      nickname,
      excludeWalletAddress
    });

    // Check if server-side Supabase is available
    if (!isSupabaseServerAvailable()) {
      console.error('❌ Server-side Supabase not configured');
      return json(
        {
          success: false,
          error: 'Server configuration error. Please check environment variables.'
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseServer.rpc('is_username_available', {
      p_username: nickname,
      exclude_wallet_addr: excludeWalletAddress?.toLowerCase() || null
    });

    if (error) {
      console.error('❌ Supabase nickname check error:', error);
      return json(
        { 
          success: false, 
          error: 'Failed to check nickname availability',
          message: error.message 
        }, 
        { status: 500 }
      );
    }

    console.log('✅ Nickname availability checked via server API:', data);
    return json({ 
      success: true, 
      available: data === true 
    });
  } catch (error) {
    console.error('❌ Nickname check error:', error);
    return json(
      { 
        success: false, 
        error: 'Nickname availability check failed',
        message: error.message 
      }, 
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile - Health check endpoint
 */
export async function GET() {
  return json({
    success: true,
    message: 'Profile API is running',
    endpoints: {
      POST: {
        upsert: 'Update or create user profile (requires JWT auth)',
        get: 'Get user profile by wallet address',
        check_nickname: 'Check if nickname is available'
      }
    }
  });
}