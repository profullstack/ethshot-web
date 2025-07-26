#!/usr/bin/env node

/**
 * Simple test runner for RPC Rate Limiter
 * Tests the rate limiting functionality without complex test framework dependencies
 */

import { RPCRateLimiter } from '../src/lib/crypto/rpc-rate-limiter.js';

// Mock provider for testing
class MockProvider {
  constructor(name = 'MockProvider', shouldFail = false, delay = 0) {
    this.name = name;
    this.shouldFail = shouldFail;
    this.delay = delay;
    this.callCount = 0;
  }

  async call(params) {
    this.callCount++;
    
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    if (this.shouldFail) {
      throw new Error('Too Many Requests');
    }
    
    return `0x${this.callCount.toString(16).padStart(64, '0')}`;
  }

  async getNetwork() {
    return { chainId: 11155111 };
  }
}

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test suite
async function runTests() {
  console.log('🧪 Starting RPC Rate Limiter Tests...\n');

  try {
    await testBasicRateLimiting();
    await testRetryMechanism();
    await testCaching();
    await testFallbackProviders();
    await testBatchRequests();
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testBasicRateLimiting() {
  console.log('📊 Testing basic rate limiting...');
  
  const rateLimiter = new RPCRateLimiter({
    maxRequestsPerSecond: 2,
    maxConcurrentRequests: 1,
    retryAttempts: 1,
    retryDelay: 100,
    cacheTTL: 1000
  });

  const provider = new MockProvider('TestProvider', false, 100);
  
  const startTime = Date.now();
  
  // Make 3 requests (should be rate limited)
  const promises = [
    rateLimiter.makeRequest(provider, 'eth_call', [{ to: '0x123' }]),
    rateLimiter.makeRequest(provider, 'eth_call', [{ to: '0x456' }]),
    rateLimiter.makeRequest(provider, 'eth_call', [{ to: '0x789' }])
  ];
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  assert(results.length === 3, 'Should return 3 results');
  assert(endTime - startTime >= 400, 'Should take at least 400ms due to rate limiting');
  
  console.log('✅ Rate limiting test passed');
}

async function testRetryMechanism() {
  console.log('🔄 Testing retry mechanism...');
  
  const rateLimiter = new RPCRateLimiter({
    maxRequestsPerSecond: 10,
    maxConcurrentRequests: 5,
    retryAttempts: 2,
    retryDelay: 50,
    cacheTTL: 1000
  });

  // Provider that fails twice then succeeds
  let callCount = 0;
  const provider = {
    call: async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('Too Many Requests');
      }
      return '0x123';
    },
    getNetwork: async () => ({ chainId: 11155111 })
  };
  
  const result = await rateLimiter.makeRequest(provider, 'eth_call', []);
  
  assert(result === '0x123', 'Should eventually succeed');
  assert(callCount === 3, 'Should have made 3 attempts (1 initial + 2 retries)');
  
  console.log('✅ Retry mechanism test passed');
}

async function testCaching() {
  console.log('💾 Testing caching...');
  
  const rateLimiter = new RPCRateLimiter({
    maxRequestsPerSecond: 10,
    maxConcurrentRequests: 5,
    retryAttempts: 1,
    retryDelay: 100,
    cacheTTL: 1000
  });

  const provider = new MockProvider('CacheTestProvider');
  
  // Make same request twice
  const result1 = await rateLimiter.makeRequest(provider, 'eth_call', [{ to: '0x123' }]);
  const result2 = await rateLimiter.makeRequest(provider, 'eth_call', [{ to: '0x123' }]);
  
  assert(result1 === result2, 'Should return same cached result');
  assert(provider.callCount === 1, 'Should only make one actual call');
  
  console.log('✅ Caching test passed');
}

async function testFallbackProviders() {
  console.log('🔄 Testing fallback providers...');
  
  const rateLimiter = new RPCRateLimiter({
    maxRequestsPerSecond: 10,
    maxConcurrentRequests: 5,
    retryAttempts: 1,
    retryDelay: 50,
    cacheTTL: 1000
  });

  const primaryProvider = new MockProvider('Primary', true); // Always fails
  const fallbackProvider = new MockProvider('Fallback', false); // Always succeeds
  
  rateLimiter.addFallbackProvider(fallbackProvider);
  
  const result = await rateLimiter.makeRequest(primaryProvider, 'eth_call', []);
  
  assert(result !== null, 'Should get result from fallback');
  assert(fallbackProvider.callCount === 1, 'Fallback should have been called');
  
  console.log('✅ Fallback providers test passed');
}

async function testBatchRequests() {
  console.log('📦 Testing batch requests...');
  
  const rateLimiter = new RPCRateLimiter({
    maxRequestsPerSecond: 10,
    maxConcurrentRequests: 5,
    retryAttempts: 1,
    retryDelay: 100,
    cacheTTL: 1000
  });

  // Mock provider that supports batch requests
  const provider = {
    call: async (method, params) => {
      if (method === 'eth_batch') {
        return params.map((req, index) => ({
          id: req.id,
          result: `0x${(index + 1).toString(16).padStart(64, '0')}`
        }));
      }
      return '0x123';
    },
    send: async (method, params) => {
      if (method === 'eth_batch') {
        return params.map((req, index) => ({
          id: req.id,
          result: `0x${(index + 1).toString(16).padStart(64, '0')}`
        }));
      }
      return '0x123';
    },
    getNetwork: async () => ({ chainId: 11155111 })
  };
  
  const requests = [
    { method: 'eth_call', params: [{ to: '0x123' }] },
    { method: 'eth_call', params: [{ to: '0x456' }] },
    { method: 'eth_call', params: [{ to: '0x789' }] }
  ];
  
  const results = await rateLimiter.batchRequests(provider, requests);
  
  assert(results.length === 3, 'Should return 3 results');
  assert(results[0].startsWith('0x'), 'Results should be hex strings');
  
  console.log('✅ Batch requests test passed');
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});