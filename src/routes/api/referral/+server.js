/**
 * Referral System API Server
 * 
 * Handles all referral-related operations on the server-side with JWT authentication.
 * This ensures security by keeping sensitive database operations server-side only.
 */

import { json } from '@sveltejs/kit';
import { validateAuthToken } from '../../../lib/services/wallet-auth-service.js';
import { supabaseServer } from '../../../lib/database/server-client.js';

/**
 * Handle POST requests for referral operations
 */
export async function POST({ request }) {
  try {
    const { action, ...params } = await request.json();
    
    console.log(`🔗 Referral API request: ${action}`, params);

    // Get server-side Supabase client
    const supabase = supabaseServer;
    if (!supabase) {
      return json({
        success: false,
        error: 'Database not available'
      }, { status: 503 });
    }

    switch (action) {
      case 'create_referral_code':
        return await handleCreateReferralCode(supabase, params);
      
      case 'process_referral_signup':
        return await handleProcessReferralSignup(supabase, params);
      
      case 'use_referral_discount':
        return await handleUseReferralDiscount(supabase, params);
      
      case 'get_referral_stats':
        return await handleGetReferralStats(supabase, params);
      
      case 'get_referral_code':
        return await handleGetReferralCode(supabase, params);
      
      case 'validate_referral_code':
        return await handleValidateReferralCode(supabase, params);

      default:
        return json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Referral API error:', error);
    return json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Create a referral code for a user
 */
async function handleCreateReferralCode(supabase, { referrerAddress, authToken }) {
  try {
    // Validate JWT token if provided (optional for some referral operations)
    if (authToken) {
      const tokenValidation = await validateAuthToken(authToken);
      if (!tokenValidation.success) {
        return json({ 
          success: false, 
          error: 'Invalid authentication token' 
        }, { status: 401 });
      }
    }

    const { data, error } = await supabase.rpc('create_referral_code', {
      referrer_addr: referrerAddress.toLowerCase()
    });

    if (error) {
      console.error('❌ Create referral code RPC error:', error);
      return json({ 
        success: false, 
        error: 'Failed to create referral code' 
      }, { status: 500 });
    }

    console.log('✅ Referral code created successfully:', data);
    return json({ 
      success: true, 
      referralCode: data 
    });

  } catch (error) {
    console.error('❌ Create referral code error:', error);
    return json({ 
      success: false, 
      error: 'Failed to create referral code' 
    }, { status: 500 });
  }
}

/**
 * Process a referral signup
 */
async function handleProcessReferralSignup(supabase, { referralCode, refereeAddress }) {
  try {
    const { data, error } = await supabase.rpc('process_referral_signup', {
      ref_code: referralCode,
      referee_addr: refereeAddress.toLowerCase()
    });

    if (error) {
      console.error('❌ Process referral signup RPC error:', error);
      return json({ 
        success: false, 
        error: 'Failed to process referral signup' 
      }, { status: 500 });
    }

    console.log('✅ Referral signup processed successfully:', data);
    return json({ 
      success: true, 
      result: data 
    });

  } catch (error) {
    console.error('❌ Process referral signup error:', error);
    return json({ 
      success: false, 
      error: 'Failed to process referral signup' 
    }, { status: 500 });
  }
}

/**
 * Use a referral discount
 */
async function handleUseReferralDiscount(supabase, { discountId, userId, authToken }) {
  try {
    // Validate JWT token for discount usage
    if (authToken) {
      const tokenValidation = await validateAuthToken(authToken);
      if (!tokenValidation.success) {
        return json({ 
          success: false, 
          error: 'Invalid authentication token' 
        }, { status: 401 });
      }
    }

    const { data, error } = await supabase.rpc('use_referral_discount', {
      p_discount_id: discountId,
      p_user_id: userId
    });

    if (error) {
      console.error('❌ Use referral discount RPC error:', error);
      return json({ 
        success: false, 
        error: 'Failed to use referral discount' 
      }, { status: 500 });
    }

    console.log('✅ Referral discount used successfully:', data);
    return json({ 
      success: true, 
      result: data 
    });

  } catch (error) {
    console.error('❌ Use referral discount error:', error);
    return json({ 
      success: false, 
      error: 'Failed to use referral discount' 
    }, { status: 500 });
  }
}

/**
 * Get referral statistics for a player
 */
async function handleGetReferralStats(supabase, { playerAddress }) {
  try {
    const { data, error } = await supabase.rpc('get_referral_stats', {
      player_addr: playerAddress.toLowerCase()
    });

    if (error) {
      console.error('❌ Get referral stats RPC error:', error);
      return json({ 
        success: false, 
        error: 'Failed to get referral stats' 
      }, { status: 500 });
    }

    console.log('✅ Referral stats retrieved successfully:', data);
    return json({ 
      success: true, 
      stats: data 
    });

  } catch (error) {
    console.error('❌ Get referral stats error:', error);
    return json({ 
      success: false, 
      error: 'Failed to get referral stats' 
    }, { status: 500 });
  }
}

/**
 * Get referral code for a referrer
 */
async function handleGetReferralCode(supabase, { referrerAddress }) {
  try {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('referrer_address', referrerAddress.toLowerCase())
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Get referral code query error:', error);
      return json({ 
        success: false, 
        error: 'Failed to get referral code' 
      }, { status: 500 });
    }

    const referralCode = data && data.length > 0 ? data[0].code : null;
    
    console.log('✅ Referral code retrieved successfully:', referralCode);
    return json({ 
      success: true, 
      referralCode 
    });

  } catch (error) {
    console.error('❌ Get referral code error:', error);
    return json({ 
      success: false, 
      error: 'Failed to get referral code' 
    }, { status: 500 });
  }
}

/**
 * Validate a referral code
 */
async function handleValidateReferralCode(supabase, { referralCode }) {
  try {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', referralCode)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .limit(1);

    if (error) {
      console.error('❌ Validate referral code query error:', error);
      return json({ 
        success: false, 
        error: 'Failed to validate referral code' 
      }, { status: 500 });
    }

    const isValid = data && data.length > 0;
    
    console.log('✅ Referral code validation completed:', { referralCode, isValid });
    return json({ 
      success: true, 
      isValid 
    });

  } catch (error) {
    console.error('❌ Validate referral code error:', error);
    return json({ 
      success: false, 
      error: 'Failed to validate referral code' 
    }, { status: 500 });
  }
}