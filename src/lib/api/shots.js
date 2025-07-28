/**
 * Shots API Client
 *
 * Handles all shot-related API operations with proper JWT authentication.
 * Provides a clean interface for shot recording operations.
 */

import { BaseApiClient } from './base.js';

/**
 * Shots API endpoints
 */
const ENDPOINTS = {
  SHOTS: '/api/shots'
};

/**
 * Shots API client that extends BaseApiClient for centralized auth
 */
export class ShotsAPI extends BaseApiClient {
  constructor(customFetch = null) {
    super('', customFetch); // Initialize base client with custom fetch
  }

  /**
   * Record a shot transaction
   * @param {Object} shotData - Shot data to record
   * @param {string} shotData.playerAddress - Player wallet address
   * @param {string} shotData.amount - Shot amount
   * @param {boolean} shotData.won - Whether the shot won
   * @param {string} shotData.txHash - Transaction hash
   * @param {number} shotData.blockNumber - Block number
   * @param {string} [shotData.timestamp] - Timestamp (defaults to now)
   * @param {string} [shotData.cryptoType] - Crypto type (defaults to 'ETH')
   * @param {string} shotData.contractAddress - Contract address
   * @returns {Promise<Object>} Shot record
   */
  async recordShot(shotData) {
    console.log('🎯 Shots API: Recording shot:', {
      playerAddress: shotData.playerAddress,
      amount: shotData.amount,
      won: shotData.won,
      txHash: shotData.txHash
    });

    try {
      const response = await this.post(ENDPOINTS.SHOTS, {
        action: 'record_shot',
        ...shotData
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to record shot');
      }

      console.log('✅ Shots API: Shot recorded successfully:', response.shot);
      return response.shot;
    } catch (error) {
      console.error('❌ Shots API: Failed to record shot:', error);
      throw new Error(`Shot recording failed: ${error.message}`);
    }
  }

  /**
   * Record a winner transaction
   * @param {Object} winnerData - Winner data to record
   * @param {string} winnerData.winnerAddress - Winner wallet address
   * @param {string} winnerData.amount - Win amount
   * @param {string} winnerData.txHash - Transaction hash
   * @param {number} winnerData.blockNumber - Block number
   * @param {string} [winnerData.timestamp] - Timestamp (defaults to now)
   * @param {string} [winnerData.cryptoType] - Crypto type (defaults to 'ETH')
   * @param {string} winnerData.contractAddress - Contract address
   * @returns {Promise<Object>} Winner record
   */
  async recordWinner(winnerData) {
    console.log('🏆 Shots API: Recording winner:', {
      winnerAddress: winnerData.winnerAddress,
      amount: winnerData.amount,
      txHash: winnerData.txHash
    });

    try {
      const response = await this.post(ENDPOINTS.SHOTS, {
        action: 'record_winner',
        ...winnerData
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to record winner');
      }

      console.log('✅ Shots API: Winner recorded successfully:', response.winner);
      return response.winner;
    } catch (error) {
      console.error('❌ Shots API: Failed to record winner:', error);
      throw new Error(`Winner recording failed: ${error.message}`);
    }
  }
}

// Create and export default instance
export const shotsAPI = new ShotsAPI();

// Export convenience functions
export const {
  recordShot,
  recordWinner
} = shotsAPI;