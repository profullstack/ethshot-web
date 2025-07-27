/**
 * Server-side Authentication API Routes
 * 
 * Handles wallet-based authentication with JWT tokens securely on the server-side.
 * This prevents exposure of sensitive operations and environment variables to the client.
 */

import { json } from '@sveltejs/kit';
import { 
  generateAuthNonce, 
  verifyAndAuthenticate, 
  validateAuthToken, 
  refreshAuthToken 
} from '../../../lib/services/wallet-auth-service.js';

/**
 * POST /api/auth - Handle authentication requests
 * Supports multiple authentication operations based on the 'action' parameter
 */
export async function POST({ request }) {
  try {
    const { action, ...params } = await request.json();

    switch (action) {
      case 'generate_nonce':
        return await handleGenerateNonce(params);
      
      case 'verify_signature':
        return await handleVerifySignature(params);
      
      case 'validate_token':
        return await handleValidateToken(params);
      
      case 'refresh_token':
        return await handleRefreshToken(params);
      
      default:
        return json(
          { 
            success: false, 
            error: 'Invalid action. Supported actions: generate_nonce, verify_signature, validate_token, refresh_token' 
          }, 
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Authentication API error:', error);
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
 * Handle nonce generation for wallet authentication
 */
async function handleGenerateNonce({ walletAddress }) {
  try {
    if (!walletAddress) {
      return json(
        { success: false, error: 'walletAddress is required' }, 
        { status: 400 }
      );
    }

    const result = await generateAuthNonce(walletAddress);
    return json(result);
  } catch (error) {
    console.error('❌ Generate nonce failed:', error);
    return json(
      { 
        success: false, 
        error: 'Failed to generate nonce',
        message: error.message 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Handle signature verification and JWT token generation
 */
async function handleVerifySignature({ walletAddress, signature }) {
  try {
    if (!walletAddress || !signature) {
      return json(
        { success: false, error: 'walletAddress and signature are required' }, 
        { status: 400 }
      );
    }

    const result = await verifyAndAuthenticate(walletAddress, signature);
    return json(result);
  } catch (error) {
    console.error('❌ Signature verification failed:', error);
    return json(
      { 
        success: false, 
        error: 'Signature verification failed',
        message: error.message 
      }, 
      { status: 401 }
    );
  }
}

/**
 * Handle JWT token validation
 */
async function handleValidateToken({ jwtToken }) {
  try {
    if (!jwtToken) {
      return json(
        { success: false, error: 'jwtToken is required' }, 
        { status: 400 }
      );
    }

    const result = await validateAuthToken(jwtToken);
    return json(result);
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    return json(
      { 
        success: false, 
        error: 'Token validation failed',
        message: error.message 
      }, 
      { status: 401 }
    );
  }
}

/**
 * Handle JWT token refresh
 */
async function handleRefreshToken({ currentToken }) {
  try {
    if (!currentToken) {
      return json(
        { success: false, error: 'currentToken is required' }, 
        { status: 400 }
      );
    }

    const result = await refreshAuthToken(currentToken);
    return json(result);
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    return json(
      { 
        success: false, 
        error: 'Token refresh failed',
        message: error.message 
      }, 
      { status: 401 }
    );
  }
}

/**
 * GET /api/auth - Health check endpoint
 */
export async function GET() {
  return json({
    success: true,
    message: 'Authentication API is running',
    endpoints: {
      POST: {
        generate_nonce: 'Generate authentication nonce for wallet',
        verify_signature: 'Verify wallet signature and get JWT token',
        validate_token: 'Validate JWT token',
        refresh_token: 'Refresh JWT token'
      }
    }
  });
}