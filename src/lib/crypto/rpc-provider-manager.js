/**
 * RPC Provider Manager
 * 
 * Manages multiple RPC providers with automatic failover,
 * load balancing, and health monitoring.
 */

import { defaultRateLimiter } from './rpc-rate-limiter.js';
import { NETWORK_CONFIG } from '../config.js';

/**
 * RPC Provider Manager class
 * Handles multiple providers with failover and health monitoring
 */
export class RPCProviderManager {
  constructor(options = {}) {
    this.providers = [];
    this.currentProviderIndex = 0;
    this.rateLimiter = options.rateLimiter || defaultRateLimiter;
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute
    this.maxFailures = options.maxFailures || 3;
    this.failureWindow = options.failureWindow || 300000; // 5 minutes
    
    // Provider health tracking
    this.providerHealth = new Map();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Add a provider to the manager
   * @param {Object} provider - Ethers provider instance
   * @param {Object} config - Provider configuration
   */
  addProvider(provider, config = {}) {
    const providerConfig = {
      provider,
      name: config.name || `Provider-${this.providers.length}`,
      priority: config.priority || 1,
      rpcUrl: config.rpcUrl,
      chainId: config.chainId,
      isHealthy: true,
      failures: [],
      lastHealthCheck: null,
      ...config
    };

    this.providers.push(providerConfig);
    this.providerHealth.set(provider, providerConfig);
    
    // Add to rate limiter as fallback
    this.rateLimiter.addFallbackProvider(provider);
    
    // Sort providers by priority (higher priority first)
    this.providers.sort((a, b) => b.priority - a.priority);
    
    console.log(`✅ Added RPC provider: ${providerConfig.name} (Priority: ${providerConfig.priority})`);
  }

  /**
   * Get the current healthy provider
   * @returns {Object|null} Provider configuration or null
   */
  getCurrentProvider() {
    const healthyProviders = this.providers.filter(p => p.isHealthy);
    
    if (healthyProviders.length === 0) {
      console.warn('⚠️ No healthy providers available');
      return this.providers[0] || null; // Fallback to first provider even if unhealthy
    }

    // Round-robin through healthy providers
    const provider = healthyProviders[this.currentProviderIndex % healthyProviders.length];
    this.currentProviderIndex = (this.currentProviderIndex + 1) % healthyProviders.length;
    
    return provider;
  }

  /**
   * Record a failure for a provider
   * @param {Object} provider - Provider instance
   * @param {Error} error - The error that occurred
   */
  recordFailure(provider, error) {
    const config = this.providerHealth.get(provider);
    if (!config) return;

    const now = Date.now();
    config.failures.push({ timestamp: now, error: error.message });
    
    // Remove old failures outside the failure window
    config.failures = config.failures.filter(
      failure => now - failure.timestamp < this.failureWindow
    );
    
    // Mark as unhealthy if too many failures
    if (config.failures.length >= this.maxFailures) {
      config.isHealthy = false;
      console.warn(`❌ Provider ${config.name} marked as unhealthy due to ${config.failures.length} failures`);
    }
  }

  /**
   * Record a success for a provider
   * @param {Object} provider - Provider instance
   */
  recordSuccess(provider) {
    const config = this.providerHealth.get(provider);
    if (!config) return;

    // Clear recent failures on success
    config.failures = [];
    
    if (!config.isHealthy) {
      config.isHealthy = true;
      console.log(`✅ Provider ${config.name} restored to healthy status`);
    }
  }

  /**
   * Perform health check on a provider
   * @param {Object} providerConfig - Provider configuration
   * @returns {Promise<boolean>} Whether provider is healthy
   */
  async checkProviderHealth(providerConfig) {
    try {
      const startTime = Date.now();
      
      // Simple health check - get latest block number
      await providerConfig.provider.getBlockNumber();
      
      const responseTime = Date.now() - startTime;
      providerConfig.lastHealthCheck = Date.now();
      providerConfig.responseTime = responseTime;
      
      this.recordSuccess(providerConfig.provider);
      return true;
    } catch (error) {
      console.warn(`❌ Health check failed for ${providerConfig.name}:`, error.message);
      this.recordFailure(providerConfig.provider, error);
      return false;
    }
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      console.log('🔍 Performing provider health checks...');
      
      const healthPromises = this.providers.map(config => 
        this.checkProviderHealth(config)
      );
      
      await Promise.allSettled(healthPromises);
      
      const healthyCount = this.providers.filter(p => p.isHealthy).length;
      console.log(`📊 Provider health: ${healthyCount}/${this.providers.length} healthy`);
    }, this.healthCheckInterval);
  }

  /**
   * Make a request using the provider manager
   * @param {string} method - RPC method
   * @param {Array} params - RPC parameters
   * @returns {Promise<*>} Response
   */
  async makeRequest(method, params = []) {
    const providerConfig = this.getCurrentProvider();
    
    if (!providerConfig) {
      throw new Error('No RPC providers available');
    }

    try {
      const result = await this.rateLimiter.makeRequest(
        providerConfig.provider,
        method,
        params
      );
      
      this.recordSuccess(providerConfig.provider);
      return result;
    } catch (error) {
      this.recordFailure(providerConfig.provider, error);
      throw error;
    }
  }

  /**
   * Batch multiple requests
   * @param {Array} requests - Array of {method, params} objects
   * @returns {Promise<Array>} Array of responses
   */
  async batchRequests(requests) {
    const providerConfig = this.getCurrentProvider();
    
    if (!providerConfig) {
      throw new Error('No RPC providers available');
    }

    try {
      const results = await this.rateLimiter.batchRequests(
        providerConfig.provider,
        requests
      );
      
      this.recordSuccess(providerConfig.provider);
      return results;
    } catch (error) {
      this.recordFailure(providerConfig.provider, error);
      throw error;
    }
  }

  /**
   * Get provider statistics
   * @returns {Object} Provider stats
   */
  getProviderStats() {
    return {
      totalProviders: this.providers.length,
      healthyProviders: this.providers.filter(p => p.isHealthy).length,
      providers: this.providers.map(config => ({
        name: config.name,
        isHealthy: config.isHealthy,
        failures: config.failures.length,
        lastHealthCheck: config.lastHealthCheck,
        responseTime: config.responseTime,
        priority: config.priority
      })),
      rateLimiter: this.rateLimiter.getStats()
    };
  }

  /**
   * Force health check on all providers
   * @returns {Promise<void>}
   */
  async forceHealthCheck() {
    console.log('🔄 Forcing health check on all providers...');
    
    const healthPromises = this.providers.map(config => 
      this.checkProviderHealth(config)
    );
    
    await Promise.allSettled(healthPromises);
  }

  /**
   * Reset provider health status
   * @param {string} providerName - Name of provider to reset (optional)
   */
  resetProviderHealth(providerName = null) {
    const providersToReset = providerName 
      ? this.providers.filter(p => p.name === providerName)
      : this.providers;

    providersToReset.forEach(config => {
      config.isHealthy = true;
      config.failures = [];
      console.log(`🔄 Reset health status for provider: ${config.name}`);
    });
  }
}

/**
 * Create and configure the default RPC provider manager
 * @returns {RPCProviderManager} Configured provider manager
 */
export const createProviderManager = () => {
  const manager = new RPCProviderManager({
    healthCheckInterval: 60000, // 1 minute
    maxFailures: 3,
    failureWindow: 300000 // 5 minutes
  });

  return manager;
};

/**
 * Setup providers from environment configuration
 * @param {RPCProviderManager} manager - Provider manager instance
 * @param {Object} ethers - Ethers library instance
 * @returns {Promise<void>}
 */
export const setupProvidersFromEnv = async (manager, ethers) => {
  // Primary provider from centralized config
  const primaryRpcUrl = NETWORK_CONFIG.RPC_URL;
  if (primaryRpcUrl) {
    try {
      const primaryProvider = new ethers.JsonRpcProvider(primaryRpcUrl);
      manager.addProvider(primaryProvider, {
        name: 'Primary-Infura',
        priority: 10,
        rpcUrl: primaryRpcUrl,
        chainId: NETWORK_CONFIG.CHAIN_ID
      });
    } catch (error) {
      console.error('Failed to setup primary provider:', error);
    }
  }

  // Fallback providers
  const fallbackProviders = [
    {
      name: 'Alchemy-Sepolia',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
      priority: 8,
      chainId: 11155111
    },
    {
      name: 'Ankr-Sepolia',
      rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
      priority: 6,
      chainId: 11155111
    },
    {
      name: 'Public-Sepolia',
      rpcUrl: 'https://sepolia.drpc.org',
      priority: 4,
      chainId: 11155111
    }
  ];

  // Add fallback providers
  for (const config of fallbackProviders) {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      manager.addProvider(provider, config);
    } catch (error) {
      console.warn(`Failed to setup fallback provider ${config.name}:`, error);
    }
  }

  console.log(`✅ Setup complete: ${manager.providers.length} providers configured`);
};

// Default instance
export const defaultProviderManager = createProviderManager();