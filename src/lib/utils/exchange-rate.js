/**
 * Exchange Rate Utility
 * 
 * Fetches real-time ETH/USD exchange rates from Tatum API
 * with caching and fallback mechanisms
 */

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const FALLBACK_RATE = 2500; // Fallback ETH/USD rate

// In-memory cache
let cachedRate = null;
let cacheTimestamp = null;

/**
 * Fetches ETH/USD exchange rate from Tatum API
 * @returns {Promise<number>} ETH price in USD
 */
export const fetchETHUSDRate = async () => {
  const apiKey = import.meta.env.TATUM_API_KEY || import.meta.env.VITE_TATUM_API_KEY;
  
  if (!apiKey || apiKey === 'your-tatum-api-key-here') {
    console.warn('Tatum API key not configured, using fallback rate');
    return FALLBACK_RATE;
  }

  // Check cache first
  if (cachedRate && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    console.log('Using cached ETH/USD rate:', cachedRate);
    return cachedRate;
  }

  try {
    console.log('Fetching fresh ETH/USD rate from Tatum API...');
    
    const response = await fetch('https://api.tatum.io/v3/tatum/rate/ETH?basePair=USD', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Tatum API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Tatum API returns rate data in different formats, handle both
    const rate = data.value || data.rate || data.price;
    
    if (!rate || isNaN(parseFloat(rate))) {
      throw new Error('Invalid rate data received from Tatum API');
    }

    const ethUsdRate = parseFloat(rate);
    
    // Update cache
    cachedRate = ethUsdRate;
    cacheTimestamp = Date.now();
    
    console.log('Successfully fetched ETH/USD rate:', ethUsdRate);
    return ethUsdRate;

  } catch (error) {
    console.error('Failed to fetch ETH/USD rate from Tatum API:', error.message);
    
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