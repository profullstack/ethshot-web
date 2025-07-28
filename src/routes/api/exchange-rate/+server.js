/**
 * Exchange Rate API Endpoint
 * 
 * Secure server-side endpoint for fetching ETH/USD exchange rates
 * Keeps TATUM_API_KEY secure on the server side
 */

import { json } from '@sveltejs/kit';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const FALLBACK_RATE = 2500; // Fallback ETH/USD rate

// Server-side cache
let cachedRate = null;
let cacheTimestamp = null;

/**
 * GET /api/exchange-rate
 * Returns current ETH/USD exchange rate
 */
export async function GET() {
  try {
    // Get API key from server environment (secure)
    const apiKey = process.env.TATUM_API_KEY;
    
    if (!apiKey || apiKey === 'your-tatum-api-key-here') {
      console.warn('Tatum API key not configured on server, using fallback rate');
      return json({ 
        rate: FALLBACK_RATE, 
        source: 'fallback',
        cached: false 
      });
    }

    // Check cache first
    if (cachedRate && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log('Returning cached ETH/USD rate:', cachedRate);
      return json({ 
        rate: cachedRate, 
        source: 'tatum',
        cached: true,
        cacheAge: Date.now() - cacheTimestamp
      });
    }

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
    
    return json({ 
      rate: ethUsdRate, 
      source: 'tatum',
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch ETH/USD rate from Tatum API:', error.message);
    
    // Return cached rate if available, otherwise fallback
    if (cachedRate) {
      console.log('Using cached ETH/USD rate due to API error:', cachedRate);
      return json({ 
        rate: cachedRate, 
        source: 'tatum',
        cached: true,
        error: 'API error, using cache',
        cacheAge: Date.now() - cacheTimestamp
      });
    }
    
    console.log('Using fallback ETH/USD rate:', FALLBACK_RATE);
    return json({ 
      rate: FALLBACK_RATE, 
      source: 'fallback',
      cached: false,
      error: error.message
    });
  }
}