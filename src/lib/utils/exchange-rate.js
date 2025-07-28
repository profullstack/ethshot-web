/**
 * Exchange Rate Utility
 *
 * Fetches real-time ETH/USD exchange rates via secure server-side API
 * with caching and fallback mechanisms
 */

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const FALLBACK_RATE = 2500; // Fallback ETH/USD rate

// In-memory cache
let cachedRate = null;
let cacheTimestamp = null;

/**
 * Fetches ETH/USD exchange rate from secure server-side API
 * @returns {Promise<number>} ETH price in USD
 */
export const fetchETHUSDRate = async () => {
  // Check cache first
  if (cachedRate && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    console.log('Using cached ETH/USD rate:', cachedRate);
    return cachedRate;
  }

  try {
    console.log('Fetching fresh ETH/USD rate from secure API...');
    
    const response = await fetch('/api/exchange-rate', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.rate || isNaN(parseFloat(data.rate))) {
      throw new Error('Invalid rate data received from exchange rate API');
    }

    const ethUsdRate = parseFloat(data.rate);
    
    // Update cache only if not using cached data from server
    if (!data.cached) {
      cachedRate = ethUsdRate;
      cacheTimestamp = Date.now();
    }
    
    console.log(`Successfully fetched ETH/USD rate: ${ethUsdRate} (source: ${data.source}, cached: ${data.cached})`);
    return ethUsdRate;

  } catch (error) {
    console.error('Failed to fetch ETH/USD rate from secure API:', error.message);
    
    // Return cached rate if available, otherwise fallback
    if (cachedRate) {
      console.log('Using cached ETH/USD rate due to API error:', cachedRate);
      return cachedRate;
    }
    
    console.log('Using fallback ETH/USD rate:', FALLBACK_RATE);
    return FALLBACK_RATE;
  }
};

/**
 * Gets current ETH/USD rate with caching
 * @returns {Promise<number>} ETH price in USD
 */
export const getCurrentETHUSDRate = async () => {
  return await fetchETHUSDRate();
};

/**
 * Clears the exchange rate cache
 */
export const clearExchangeRateCache = () => {
  cachedRate = null;
  cacheTimestamp = null;
  console.log('Exchange rate cache cleared');
};

/**
 * Gets cached rate info for debugging
 * @returns {object} Cache status information
 */
export const getCacheInfo = () => {
  return {
    cachedRate,
    cacheTimestamp,
    cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
    isExpired: cacheTimestamp ? (Date.now() - cacheTimestamp > CACHE_DURATION) : true
  };
};