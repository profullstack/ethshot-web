// Test suite for RPC rate limiting system
// Using Jest for testing framework

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RPCRateLimiter } from '../src/lib/crypto/rpc-rate-limiter.js';

describe('RPCRateLimiter', () => {
  let rateLimiter;
  let mockProvider;

  beforeEach(() => {
    // Mock provider with call method
    mockProvider = {
      call: jest.fn(),
      getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111 })
    };

    rateLimiter = new RPCRateLimiter({
      maxRequestsPerSecond: 2,
      maxConcurrentRequests: 3,
      retryAttempts: 3,
      retryDelay: 100,
      cacheTTL: 5000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should limit requests per second', async () => {
      const startTime = Date.now();
      mockProvider.call.mockResolvedValue('0x123');

      // Make 3 requests (exceeds limit of 2 per second)
      const promises = [
        rateLimiter.makeRequest(mockProvider, 'eth_call', []),
        rateLimiter.makeRequest(mockProvider, 'eth_call', []),
        rateLimiter.makeRequest(mockProvider, 'eth_call', [])
      ];

      await Promise.all(promises);
      const endTime = Date.now();

      // Should take at least 500ms due to rate limiting
      expect(endTime - startTime).toBeGreaterThanOrEqual(400);
      expect(mockProvider.call).toHaveBeenCalledTimes(3);
    });

    it('should limit concurrent requests', async () => {
      let activeRequests = 0;
      let maxConcurrent = 0;

      mockProvider.call.mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        await new Promise(resolve => setTimeout(resolve, 100));
        activeRequests--;
        return '0x123';
      });

      // Make 5 requests (exceeds concurrent limit of 3)
      const promises = Array(5).fill().map(() => 
        rateLimiter.makeRequest(mockProvider, 'eth_call', [])
      );

      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(mockProvider.call).toHaveBeenCalledTimes(5);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on rate limit errors', async () => {
      mockProvider.call
        .mockRejectedValueOnce(new Error('Too Many Requests'))
        .mockRejectedValueOnce(new Error('Too Many Requests'))
        .mockResolvedValueOnce('0x123');

      const result = await rateLimiter.makeRequest(mockProvider, 'eth_call', []);

      expect(result).toBe('0x123');
      expect(mockProvider.call).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      mockProvider.call.mockRejectedValue(new Error('Too Many Requests'));

      await expect(
        rateLimiter.makeRequest(mockProvider, 'eth_call', [])
      ).rejects.toThrow('Too Many Requests');

      expect(mockProvider.call).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should use exponential backoff for retries', async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      });

      mockProvider.call
        .mockRejectedValueOnce(new Error('Too Many Requests'))
        .mockRejectedValueOnce(new Error('Too Many Requests'))
        .mockResolvedValueOnce('0x123');

      await rateLimiter.makeRequest(mockProvider, 'eth_call', []);

      expect(delays).toEqual([100, 200]); // Exponential backoff
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      mockProvider.call.mockResolvedValue('0x123');

      const result1 = await rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }]);
      const result2 = await rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }]);

      expect(result1).toBe('0x123');
      expect(result2).toBe('0x123');
      expect(mockProvider.call).toHaveBeenCalledTimes(1); // Second call served from cache
    });

    it('should not cache failed responses', async () => {
      mockProvider.call
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('0x123');

      await expect(
        rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }])
      ).rejects.toThrow('Network error');

      const result = await rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }]);
      expect(result).toBe('0x123');
      expect(mockProvider.call).toHaveBeenCalledTimes(5); // 4 for first (1+3 retries) + 1 for second
    });

    it('should expire cached responses after TTL', async () => {
      jest.useFakeTimers();
      mockProvider.call.mockResolvedValue('0x123');

      await rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }]);
      
      // Fast forward past cache TTL
      jest.advanceTimersByTime(6000);
      
      await rateLimiter.makeRequest(mockProvider, 'eth_call', [{ to: '0x123' }]);

      expect(mockProvider.call).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('Request Batching', () => {
    it('should batch multiple requests', async () => {
      mockProvider.call.mockResolvedValue([
        { result: '0x123' },
        { result: '0x456' },
        { result: '0x789' }
      ]);

      const requests = [
        { method: 'eth_call', params: [{ to: '0x123' }] },
        { method: 'eth_call', params: [{ to: '0x456' }] },
        { method: 'eth_call', params: [{ to: '0x789' }] }
      ];

      const results = await rateLimiter.batchRequests(mockProvider, requests);

      expect(results).toEqual(['0x123', '0x456', '0x789']);
      expect(mockProvider.call).toHaveBeenCalledTimes(1);
    });

    it('should handle batch request failures gracefully', async () => {
      mockProvider.call.mockResolvedValue([
        { result: '0x123' },
        { error: { message: 'Contract not found' } },
        { result: '0x789' }
      ]);

      const requests = [
        { method: 'eth_call', params: [{ to: '0x123' }] },
        { method: 'eth_call', params: [{ to: '0x456' }] },
        { method: 'eth_call', params: [{ to: '0x789' }] }
      ];

      const results = await rateLimiter.batchRequests(mockProvider, requests);

      expect(results[0]).toBe('0x123');
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBe('0x789');
    });
  });

  describe('Fallback Providers', () => {
    it('should fallback to next provider on failure', async () => {
      const fallbackProvider = {
        call: jest.fn().mockResolvedValue('0x456'),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111 })
      };

      rateLimiter.addFallbackProvider(fallbackProvider);
      mockProvider.call.mockRejectedValue(new Error('Primary provider failed'));

      const result = await rateLimiter.makeRequest(mockProvider, 'eth_call', []);

      expect(result).toBe('0x456');
      expect(mockProvider.call).toHaveBeenCalledTimes(4); // 1 + 3 retries
      expect(fallbackProvider.call).toHaveBeenCalledTimes(1);
    });

    it('should cycle through all fallback providers', async () => {
      const fallbackProvider1 = {
        call: jest.fn().mockRejectedValue(new Error('Fallback 1 failed')),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111 })
      };
      
      const fallbackProvider2 = {
        call: jest.fn().mockResolvedValue('0x789'),
        getNetwork: jest.fn().mockResolvedValue({ chainId: 11155111 })
      };

      rateLimiter.addFallbackProvider(fallbackProvider1);
      rateLimiter.addFallbackProvider(fallbackProvider2);
      mockProvider.call.mockRejectedValue(new Error('Primary provider failed'));

      const result = await rateLimiter.makeRequest(mockProvider, 'eth_call', []);

      expect(result).toBe('0x789');
      expect(fallbackProvider2.call).toHaveBeenCalledTimes(1);
    });
  });
});