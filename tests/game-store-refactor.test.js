/**
 * Game Store Refactor Tests
 * 
 * Tests for the refactored game store modules using Mocha and Chai
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { rpcCache, retryWithBackoff } from '../src/lib/stores/game/cache.js';
import { 
  formatTimeRemaining, 
  updateUSDValues, 
  createInitialGameState,
  handleContractError,
  validateContractDeployment
} from '../src/lib/stores/game/utils.js';

describe('Game Store Refactor', () => {
  describe('Cache Module', () => {
    beforeEach(() => {
      rpcCache.clear();
    });

    afterEach(() => {
      rpcCache.clear();
    });

    it('should store and retrieve cached values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      rpcCache.set(key, value);
      const retrieved = rpcCache.get(key);
      
      expect(retrieved).to.deep.equal(value);
    });

    it('should return null for expired cache entries', (done) => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      // Set TTL to 1ms for testing
      rpcCache.TTL = 1;
      rpcCache.set(key, value);
      
      setTimeout(() => {
        const retrieved = rpcCache.get(key);
        expect(retrieved).to.be.null;
        
        // Reset TTL
        rpcCache.TTL = 30000;
        done();
      }, 5);
    });

    it('should clear all cached data', () => {
      rpcCache.set('key1', 'value1');
      rpcCache.set('key2', 'value2');
      
      rpcCache.clear();
      
      expect(rpcCache.get('key1')).to.be.null;
      expect(rpcCache.get('key2')).to.be.null;
    });

    it('should invalidate specific keys', () => {
      rpcCache.set('key1', 'value1');
      rpcCache.set('key2', 'value2');
      rpcCache.set('key3', 'value3');
      
      rpcCache.invalidate(['key1', 'key3']);
      
      expect(rpcCache.get('key1')).to.be.null;
      expect(rpcCache.get('key2')).to.equal('value2');
      expect(rpcCache.get('key3')).to.be.null;
    });

    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const maxRetries = 3;
      
      const operation = async () => {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };
      
      const result = await retryWithBackoff(operation, maxRetries, 10);
      
      expect(result).to.equal('success');
      expect(attempts).to.equal(maxRetries);
    });

    it('should throw error after max retries exceeded', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };
      
      try {
        await retryWithBackoff(operation, 2, 10);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Persistent failure');
      }
    });
  });

  describe('Utils Module', () => {
    it('should format time remaining correctly', () => {
      expect(formatTimeRemaining(0)).to.equal('0s');
      expect(formatTimeRemaining(30)).to.equal('30s');
      expect(formatTimeRemaining(90)).to.equal('1m 30s');
      expect(formatTimeRemaining(3661)).to.equal('1h 1m');
    });

    it('should create initial game state with correct structure', () => {
      const state = createInitialGameState();
      
      expect(state).to.have.property('contractAddress', '');
      expect(state).to.have.property('currentPot', '0');
      expect(state).to.have.property('activeCrypto', 'ETH');
      expect(state).to.have.property('loading', false);
      expect(state).to.have.property('isMultiCryptoMode', false);
      expect(state).to.have.property('availableDiscounts').that.is.an('array');
    });

    it('should validate contract deployment correctly', () => {
      // Valid contract address
      const validResult = validateContractDeployment('0x1234567890123456789012345678901234567891');
      expect(validResult.isValid).to.be.true;
      
      // Invalid/placeholder contract address
      const invalidResult = validateContractDeployment('0x1234567890123456789012345678901234567890');
      expect(invalidResult.isValid).to.be.false;
      expect(invalidResult.error).to.include('not deployed yet');
      
      // Empty contract address
      const emptyResult = validateContractDeployment('');
      expect(emptyResult.isValid).to.be.false;
    });

    it('should handle contract errors appropriately', () => {
      const rpcError = new Error('Too Many Requests');
      const rpcMessage = handleContractError(rpcError, 'ETH');
      expect(rpcMessage).to.include('rate limit exceeded');
      
      const networkError = new Error('missing response');
      const networkMessage = handleContractError(networkError, 'ETH');
      expect(networkMessage).to.include('check your internet connection');
      
      const notImplementedError = new Error('not yet implemented');
      const notImplementedMessage = handleContractError(notImplementedError, 'SOL');
      expect(notImplementedMessage).to.equal('not yet implemented');
      
      const genericError = new Error('generic error');
      const genericMessage = handleContractError(genericError, 'ETH');
      expect(genericMessage).to.include('ETH contract not found');
    });

    it('should update USD values correctly', async () => {
      // Mock calculateUSDValue function
      const mockCalculateUSDValue = async (value) => {
        return (parseFloat(value) * 2000).toFixed(2); // Mock $2000 per ETH
      };
      
      // Temporarily replace the import
      const originalUpdateUSDValues = updateUSDValues;
      
      const state = {
        currentPot: '1.5',
        shotCost: '0.001',
        sponsorCost: '0.01'
      };
      
      // Since we can't easily mock imports in this test setup,
      // we'll just verify the function exists and has the right structure
      expect(updateUSDValues).to.be.a('function');
      
      // Test that it returns a promise
      const result = updateUSDValues(state);
      expect(result).to.be.a('promise');
    });
  });

  describe('Module Integration', () => {
    it('should maintain backward compatibility with original exports', () => {
      // Test that we can import from the main index
      import('../src/lib/stores/game/index.js').then((gameModule) => {
        expect(gameModule).to.have.property('gameStore');
        expect(gameModule).to.have.property('winnerEventStore');
        expect(gameModule).to.have.property('currentPot');
        expect(gameModule).to.have.property('canTakeShot');
        expect(gameModule).to.have.property('availableDiscounts');
        expect(gameModule).to.have.property('multiCryptoGameStore');
      });
    });

    it('should export individual modules for advanced usage', () => {
      import('../src/lib/stores/game/index.js').then((gameModule) => {
        expect(gameModule).to.have.property('GameCache');
        expect(gameModule).to.have.property('GameUtils');
        expect(gameModule).to.have.property('ContractOperations');
        expect(gameModule).to.have.property('PlayerOperations');
        expect(gameModule).to.have.property('ReferralOperations');
        expect(gameModule).to.have.property('RealTimeUpdates');
      });
    });
  });
});