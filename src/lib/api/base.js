/**
 * Base API Client
 * 
 * Provides a centralized HTTP client with JWT authentication for all API calls.
 * Handles token management, request/response logging, and error handling.
 */

import { get } from 'svelte/store';
import { walletAddress } from '../stores/wallet.js';

/**
 * Base API client class with JWT authentication
 */
export class BaseApiClient {
  constructor(baseURL = '', customFetch = null) {
    this.baseURL = baseURL;
    this.fetchFn = customFetch || globalThis.fetch;
  }

  /**
   * Get JWT token for authenticated requests from localStorage
   * @returns {Promise<string>} JWT token
   * @throws {Error} If no valid token is found
   */
  async getAuthToken() {
    const currentWalletAddress = get(walletAddress);
    if (!currentWalletAddress) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    // Get JWT token from localStorage (set by server-side authentication)
    const jwtToken = localStorage.getItem('ethshot_jwt_token');
    const storedWalletAddress = localStorage.getItem('ethshot_wallet_address');
    const expiresAtStr = localStorage.getItem('ethshot_auth_expires_at');

    if (!jwtToken || !storedWalletAddress) {
      throw new Error('No authentication token found. Please connect and authenticate your wallet first by clicking the wallet connect button.');
    }

    // Verify the stored wallet matches the current wallet
    if (storedWalletAddress.toLowerCase() !== currentWalletAddress.toLowerCase()) {
      throw new Error('Authentication token is for a different wallet. Please sign in again.');
    }

    // Check if token is expired
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (expiresAt && expiresAt < currentTime) {
        // Clear expired token
        localStorage.removeItem('ethshot_jwt_token');
        localStorage.removeItem('ethshot_wallet_address');
        localStorage.removeItem('ethshot_auth_expires_at');
        throw new Error('Authentication token has expired. Please sign in again.');
      }
    }

    console.log('🔑 Using stored JWT token for API request:', {
      walletAddress: currentWalletAddress,
      storedWalletAddress,
      tokenLength: jwtToken.length,
      tokenStart: jwtToken.substring(0, 20),
      tokenEnd: jwtToken.substring(jwtToken.length - 20),
      expiresAtStr,
      currentTime: Math.floor(Date.now() / 1000)
    });

    return jwtToken;
  }

  /**
   * Make an authenticated HTTP request
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Fetch options
   * @param {boolean} requireAuth - Whether authentication is required (default: true)
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}, requireAuth = true) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add JWT authentication if required
    if (requireAuth) {
      try {
        const token = await this.getAuthToken();
        headers.Authorization = `Bearer ${token}`;
        
        console.log('🔐 Making authenticated API request:', {
          method: options.method || 'GET',
          url,
          hasAuth: !!headers.Authorization,
          tokenPreview: headers.Authorization.substring(0, 30) + '...',
          authHeaderLength: headers.Authorization.length,
          fullHeaders: Object.keys(headers)
        });
      } catch (authError) {
        console.error('❌ Authentication failed for API request:', authError);
        throw authError;
      }
    } else {
      console.log('🌐 Making unauthenticated API request:', {
        method: options.method || 'GET',
        url
      });
    }

    // Make the request
    try {
      const response = await this.fetchFn(url, {
        ...options,
        headers
      });

      console.log('📡 API response received:', {
        status: response.status,
        statusText: response.statusText,
        url
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle HTTP errors
      if (!response.ok) {
        console.error('❌ API request failed:', {
          status: response.status,
          statusText: response.statusText,
          data
        });

        const error = new Error(
          data?.message || 
          data?.error || 
          `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.response = data;
        throw error;
      }

      console.log('✅ API request successful:', {
        url,
        dataType: typeof data,
        hasData: !!data
      });

      return data;
    } catch (error) {
      console.error('❌ API request error:', {
        url,
        error: error.message,
        stack: error.stack
      });

      // Re-throw with additional context
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error: Unable to connect to ${url}`);
      }
      
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional options
   * @param {boolean} requireAuth - Whether authentication is required
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, options = {}, requireAuth = true) {
    return this.request(endpoint, {
      method: 'GET',
      ...options
    }, requireAuth);
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request body data
   * @param {Object} options - Additional options
   * @param {boolean} requireAuth - Whether authentication is required
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = null, options = {}, requireAuth = true) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
      ...options
    }, requireAuth);
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request body data
   * @param {Object} options - Additional options
   * @param {boolean} requireAuth - Whether authentication is required
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = null, options = {}, requireAuth = true) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
      ...options
    }, requireAuth);
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional options
   * @param {boolean} requireAuth - Whether authentication is required
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, options = {}, requireAuth = true) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    }, requireAuth);
  }
}

// Create default API client instance
export const apiClient = new BaseApiClient();

// Export convenience methods
export const { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete } = apiClient;

// Export the base class for extension
export { BaseApiClient as APIClient };