/**
 * RPC Cache Module
 * 
 * Provides caching functionality to reduce RPC calls and improve performance
 */

/**
 * Cache for reducing RPC calls
 */
export const rpcCache = {
  data: new Map(),
  timestamps: new Map(),
  TTL: 30000, // 30 seconds cache
  
  get(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp < this.TTL) {
      return this.data.get(key);
    }
    return null;
  },
  
  set(key, value) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
  },
  
  invalidate(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        this.data.delete(key);
        this.timestamps.delete(key);
      });
    } else {
      this.data.delete(keys);
      this.timestamps.delete(keys);
    }
  }
};

/**
 * Helper function to retry operations with exponential backoff
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of the operation
 */
export const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Don't retry on certain errors
      if (error.message.includes('Too Many Requests') && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};