/**
 * RPC Rate Limiter
 * 
 * Provides rate limiting, retry logic, caching, and fallback providers
 * for Ethereum RPC requests to prevent hitting provider rate limits.
 */

/**
 * RPC Rate Limiter class
 * Handles rate limiting, retries, caching, and fallback providers for RPC requests
 */
export class RPCRateLimiter {
  constructor(options = {}) {
    // Rate limiting configuration
    this.maxRequestsPerSecond = options.maxRequestsPerSecond || 10;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.cacheTTL = options.cacheTTL || 30000; // 30 seconds default

    // Internal state
    this.requestQueue = [];
    this.activeRequests = 0;
    this.lastRequestTime = 0;
    this.requestTimes = [];
    this.cache = new Map();
    this.fallbackProviders = [];

    // Start processing queue
    this.processQueue();
  }

  /**
   * Add a fallback provider
   * @param {Object} provider - Ethers provider instance
   */
  addFallbackProvider(provider) {
    this.fallbackProviders.push(provider);
  }

  /**
   * Generate cache key for request
   * @param {string} method - RPC method
   * @param {Array} params - RPC parameters
   * @returns {string} Cache key
   */
  generateCacheKey(method, params) {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Check if request should be cached
   * @param {string} method - RPC method
   * @returns {boolean} Whether to cache this method
   */
  shouldCache(method) {
    const cacheableMethods = [
      'eth_call',
      'eth_getBalance',
      'eth_getCode',
      'eth_getStorageAt',
      'eth_getTransactionCount',
      'eth_getBlockByNumber',
      'eth_getBlockByHash',
      'eth_getLogs'
    ];
    return cacheableMethods.includes(method);
  }

  /**
   * Get cached response if available and not expired
   * @param {string} cacheKey - Cache key
   * @returns {*} Cached response or null
   */
  getCachedResponse(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const { response, timestamp } = cached;
    if (Date.now() - timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return response;
  }

  /**
   * Cache successful response
   * @param {string} cacheKey - Cache key
   * @param {*} response - Response to cache
   */
  setCachedResponse(cacheKey, response) {
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if we can make a request now (rate limiting)
   * @returns {boolean} Whether we can make a request
   */
  canMakeRequest() {
    const now = Date.now();
    
    // Remove old request times (older than 1 second)
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000);
    
    // Check rate limit
    if (this.requestTimes.length >= this.maxRequestsPerSecond) {
      return false;
    }
    
    // Check concurrent requests
    if (this.activeRequests >= this.maxConcurrentRequests) {
      return false;
    }
    
    return true;
  }

  /**
   * Wait for rate limit to allow next request
   * @returns {Promise<void>}
   */
  async waitForRateLimit() {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.canMakeRequest()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50); // Check every 50ms
    });
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    while (true) {
      if (this.requestQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }

      if (!this.canMakeRequest()) {
        await this.waitForRateLimit();
        continue;
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.executeRequest(request);
      }
    }
  }

  /**
   * Execute a single request
   * @param {Object} request - Request object
   */
  async executeRequest(request) {
    const { provider, method, params, resolve, reject, attempt = 0 } = request;
    
    this.activeRequests++;
    this.requestTimes.push(Date.now());

    try {
      const result = await this.callProvider(provider, method, params);
      
      // Cache successful response if cacheable
      if (this.shouldCache(method)) {
        const cacheKey = this.generateCacheKey(method, params);
        this.setCachedResponse(cacheKey, result);
      }
      
      resolve(result);
    } catch (error) {
      // Check if this is a rate limit error and we should retry
      if (this.shouldRetry(error, attempt)) {
        const delay = this.calculateRetryDelay(attempt);
        setTimeout(() => {
          this.requestQueue.unshift({
            ...request,
            attempt: attempt + 1
          });
        }, delay);
      } else {
        // Try fallback providers
        const fallbackResult = await this.tryFallbackProviders(method, params);
        if (fallbackResult !== null) {
          resolve(fallbackResult);
        } else {
          reject(error);
        }
      }
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Call provider with method and params
   * @param {Object} provider - Ethers provider
   * @param {string} method - RPC method
   * @param {Array} params - RPC parameters
   * @returns {Promise<*>} Response
   */
  async callProvider(provider, method, params) {
    if (method === 'eth_call' && params.length > 0) {
      return await provider.call(params[0], params[1] || 'latest');
    } else if (method === 'eth_getBalance') {
      return await provider.getBalance(params[0], params[1] || 'latest');
    } else if (method === 'eth_getTransactionCount') {
      return await provider.getTransactionCount(params[0], params[1] || 'latest');
    } else if (method === 'eth_getCode') {
      return await provider.getCode(params[0], params[1] || 'latest');
    } else if (method === 'eth_getBlockByNumber') {
      return await provider.getBlock(params[0], params[1] || false);
    } else if (method === 'eth_getLogs') {
      return await provider.getLogs(params[0]);
    } else {
      // Generic call for other methods
      return await provider.send(method, params);
    }
  }

  /**
   * Check if error should trigger a retry
   * @param {Error} error - The error
   * @param {number} attempt - Current attempt number
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, attempt) {
    if (attempt >= this.retryAttempts) return false;
    
    const retryableErrors = [
      'Too Many Requests',
      'rate limit',
      'timeout',
      'network error',
      'connection error',
      'ECONNRESET',
      'ETIMEDOUT',
      'missing response'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    return this.retryDelay * Math.pow(2, attempt);
  }

  /**
   * Try fallback providers
   * @param {string} method - RPC method
   * @param {Array} params - RPC parameters
   * @returns {Promise<*>} Response or null if all failed
   */
  async tryFallbackProviders(method, params) {
    for (const fallbackProvider of this.fallbackProviders) {
      try {
        const result = await this.callProvider(fallbackProvider, method, params);
        console.log('✅ Fallback provider succeeded');
        return result;
      } catch (error) {
        console.warn('❌ Fallback provider failed:', error.message);
        continue;
      }
    }
    return null;
  }

  /**
   * Make a rate-limited RPC request
   * @param {Object} provider - Ethers provider
   * @param {string} method - RPC method
   * @param {Array} params - RPC parameters
   * @returns {Promise<*>} Response
   */
  async makeRequest(provider, method, params = []) {
    // Check cache first
    if (this.shouldCache(method)) {
      const cacheKey = this.generateCacheKey(method, params);
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse !== null) {
        return cachedResponse;
      }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        provider,
        method,
        params,
        resolve,
        reject
      });
    });
  }

  /**
   * Batch multiple requests into a single RPC call
   * @param {Object} provider - Ethers provider
   * @param {Array} requests - Array of {method, params} objects
   * @returns {Promise<Array>} Array of responses
   */
  async batchRequests(provider, requests) {
    // For providers that support batch requests
    if (provider.send && requests.length > 1) {
      try {
        const batchPayload = requests.map((req, index) => ({
          id: index + 1,
          jsonrpc: '2.0',
          method: req.method,
          params: req.params
        }));

        const batchResponse = await provider.send('eth_batch', batchPayload);
        
        return batchResponse.map(response => {
          if (response.error) {
            return new Error(response.error.message);
          }
          return response.result;
        });
      } catch (error) {
        console.warn('Batch request failed, falling back to individual requests:', error.message);
      }
    }

    // Fallback to individual requests
    const results = await Promise.allSettled(
      requests.map(req => this.makeRequest(provider, req.method, req.params))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return result.reason;
      }
    });
  }

  /**
   * Clear all cached responses
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      hits: this.cacheHits || 0,
      misses: this.cacheMisses || 0
    };
  }

  /**
   * Get rate limiter statistics
   * @returns {Object} Rate limiter stats
   */
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      requestsInLastSecond: this.requestTimes.length,
      fallbackProviders: this.fallbackProviders.length,
      cache: this.getCacheStats()
    };
  }
}

/**
 * Create a singleton instance for the application
 */
export const createRPCRateLimiter = (options = {}) => {
  return new RPCRateLimiter({
    maxRequestsPerSecond: 8, // Conservative limit for Infura
    maxConcurrentRequests: 3,
    retryAttempts: 3,
    retryDelay: 1000,
    cacheTTL: 30000, // 30 seconds
    ...options
  });
};

// Default instance
export const defaultRateLimiter = createRPCRateLimiter();