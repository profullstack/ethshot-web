/**
 * Shots API Endpoint
 *
 * Handles shot recording and winner recording with ES256 JWT authentication
 */

import { json } from '@sveltejs/kit';
import { verifyJWTSecure } from '../../../lib/server/jwt-auth-secure.js';
import { getSupabaseJWTClient, isSupabaseServerAvailable } from '../../../lib/database/server-client.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'record_shot':
        return await handleRecordShot(request, data);
      
      case 'record_winner':
        return await handleRecordWinner(request, data);
      
      default:
        return json({
          success: false,
          error: 'Invalid action. Supported actions: record_shot, record_winner'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Shots API error:', error);
    return json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Handle shot recording with JWT authentication
 */
async function handleRecordShot(request, shotData) {
  try {
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
      const payload = verifyJWTSecure(token);
      walletAddress = payload.walletAddress || payload.wallet_address || payload.sub;
      
      if (!walletAddress) {
        console.error('❌ JWT payload missing wallet address:', payload);
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

    // Verify the wallet address matches the shot data
    if (walletAddress.toLowerCase() !== shotData.playerAddress.toLowerCase()) {
      return json(
        { success: false, error: 'Wallet address mismatch' },
        { status: 403 }
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

    console.log('🎯 Recording shot via secure API:', {
      playerAddress: shotData.playerAddress,
      amount: shotData.amount,
      won: shotData.won,
      txHash: shotData.txHash
    });

    // Use Supabase client with JWT authentication
    const supabase = getSupabaseJWTClient(token);
    
    const { data, error } = await supabase.rpc('record_shot_secure', {
      p_player_address: shotData.playerAddress.toLowerCase(),
      p_amount: shotData.amount,
      p_won: shotData.won,
      p_tx_hash: shotData.txHash,
      p_block_number: shotData.blockNumber,
      p_timestamp: shotData.timestamp || new Date().toISOString(),
      p_crypto_type: shotData.cryptoType || 'ETH',
      p_contract_address: shotData.contractAddress
    });

    if (error) {
      console.error('❌ Supabase shot recording error:', error);
      return json(
        {
          success: false,
          error: 'Failed to record shot',
          message: error.message
        },
        { status: 500 }
      );
    }

    console.log('✅ Shot recorded successfully via secure API:', data);

    return json({
      success: true,
      shot: data,
      message: 'Shot recorded successfully'
    });

  } catch (error) {
    console.error('❌ Failed to record shot via secure API:', error);
    
    // Provide specific error messages
    if (error.message?.includes('JWT') || error.message?.includes('authentication')) {
      return json({
        success: false,
        error: 'Authentication required. Please reconnect your wallet.'
      }, { status: 401 });
    } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
      return json({
        success: false,
        error: 'Access denied. Please ensure you are properly authenticated.'
      }, { status: 403 });
    } else {
      return json({
        success: false,
        error: error.message || 'Failed to record shot'
      }, { status: 500 });
    }
  }
}

/**
 * Handle winner recording with JWT authentication
 */
async function handleRecordWinner(request, winnerData) {
  try {
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
      const payload = verifyJWTSecure(token);
      walletAddress = payload.walletAddress || payload.wallet_address || payload.sub;

      if (!walletAddress) {
        console.error('❌ JWT payload missing wallet address:', payload);
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

    // Verify the wallet address matches the winner data
    if (!winnerData.winnerAddress ||
        walletAddress.toLowerCase() !== winnerData.winnerAddress.toLowerCase()) {
      return json(
        { success: false, error: 'Wallet address mismatch' },
        { status: 403 }
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

    console.log('🏆 Recording winner via secure API:', {
      winnerAddress: winnerData.winnerAddress,
      amount: winnerData.amount,
      txHash: winnerData.txHash
    });

    // Use Supabase client with JWT authentication + the record_winner_secure RPC,
    // mirroring handleRecordShot. The RPC re-verifies the wallet address server-side.
    const supabase = getSupabaseJWTClient(token);

    const { data, error } = await supabase.rpc('record_winner_secure', {
      p_winner_address: winnerData.winnerAddress.toLowerCase(),
      p_amount: winnerData.amount,
      p_tx_hash: winnerData.txHash,
      p_block_number: winnerData.blockNumber,
      p_timestamp: winnerData.timestamp || new Date().toISOString(),
      p_crypto_type: winnerData.cryptoType || 'ETH',
      p_contract_address: winnerData.contractAddress
    });

    if (error) {
      console.error('❌ Supabase winner recording error:', error);
      return json(
        {
          success: false,
          error: 'Failed to record winner',
          message: error.message
        },
        { status: 500 }
      );
    }

    console.log('✅ Winner recorded successfully via secure API:', data);

    return json({
      success: true,
      winner: data,
      message: 'Winner recorded successfully'
    });

  } catch (error) {
    console.error('❌ Failed to record winner via API:', error);
    
    // Provide specific error messages
    if (error.message?.includes('JWT') || error.message?.includes('authentication')) {
      return json({
        success: false,
        error: 'Authentication required. Please reconnect your wallet.'
      }, { status: 401 });
    } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
      return json({
        success: false,
        error: 'Access denied. Please ensure you are properly authenticated.'
      }, { status: 403 });
    } else {
      return json({
        success: false,
        error: error.message || 'Failed to record winner'
      }, { status: 500 });
    }
  }
}