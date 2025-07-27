/**
 * Storage Cleanup Utilities
 * 
 * Provides comprehensive cleanup functions for localStorage and sessionStorage
 * when users disconnect their wallets or sign out.
 */

/**
 * Clear all authentication-related data from both localStorage and sessionStorage
 * @param {boolean} verbose - Whether to log detailed cleanup information
 * @returns {Object} Summary of cleared items
 */
export function clearAllAuthStorage(verbose = true) {
  const clearedItems = {
    localStorage: [],
    sessionStorage: []
  };

  try {
    if (verbose) {
      console.log('🧹 Starting comprehensive storage cleanup...');
    }

    // Define patterns for authentication-related keys
    const authPatterns = [
      'ethshot_',
      'auth',
      'wallet',
      'jwt',
      'token',
      'session',
      'user',
      'supabase'
    ];

    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      const shouldClear = authPatterns.some(pattern => 
        key.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (shouldClear) {
        localStorage.removeItem(key);
        clearedItems.localStorage.push(key);
        if (verbose) {
          console.log(`🧹 Cleared localStorage: ${key}`);
        }
      }
    });

    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      const shouldClear = authPatterns.some(pattern => 
        key.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (shouldClear) {
        sessionStorage.removeItem(key);
        clearedItems.sessionStorage.push(key);
        if (verbose) {
          console.log(`🧹 Cleared sessionStorage: ${key}`);
        }
      }
    });

    if (verbose) {
      console.log('✅ Storage cleanup completed:', {
        localStorageCleared: clearedItems.localStorage.length,
        sessionStorageCleared: clearedItems.sessionStorage.length,
        totalCleared: clearedItems.localStorage.length + clearedItems.sessionStorage.length
      });
    }

    return clearedItems;
  } catch (error) {
    console.error('❌ Storage cleanup failed:', error);
    throw error;
  }
}

/**
 * Clear specific authentication keys from both storages
 * @param {string[]} keys - Array of specific keys to clear
 * @param {boolean} verbose - Whether to log detailed cleanup information
 * @returns {Object} Summary of cleared items
 */
export function clearSpecificAuthKeys(keys, verbose = true) {
  const clearedItems = {
    localStorage: [],
    sessionStorage: []
  };

  try {
    if (verbose) {
      console.log('🧹 Clearing specific authentication keys:', keys);
    }

    keys.forEach(key => {
      // Clear from localStorage
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        clearedItems.localStorage.push(key);
        if (verbose) {
          console.log(`🧹 Cleared localStorage: ${key}`);
        }
      }

      // Clear from sessionStorage
      if (sessionStorage.getItem(key) !== null) {
        sessionStorage.removeItem(key);
        clearedItems.sessionStorage.push(key);
        if (verbose) {
          console.log(`🧹 Cleared sessionStorage: ${key}`);
        }
      }
    });

    if (verbose) {
      console.log('✅ Specific key cleanup completed:', clearedItems);
    }

    return clearedItems;
  } catch (error) {
    console.error('❌ Specific key cleanup failed:', error);
    throw error;
  }
}

/**
 * Get all authentication-related keys from both storages
 * @returns {Object} Object containing arrays of auth-related keys
 */
export function getAuthStorageKeys() {
  const authPatterns = [
    'ethshot_',
    'auth',
    'wallet',
    'jwt',
    'token',
    'session',
    'user',
    'supabase'
  ];

  const authKeys = {
    localStorage: [],
    sessionStorage: []
  };

  // Check localStorage
  Object.keys(localStorage).forEach(key => {
    const isAuthRelated = authPatterns.some(pattern => 
      key.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isAuthRelated) {
      authKeys.localStorage.push(key);
    }
  });

  // Check sessionStorage
  Object.keys(sessionStorage).forEach(key => {
    const isAuthRelated = authPatterns.some(pattern => 
      key.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isAuthRelated) {
      authKeys.sessionStorage.push(key);
    }
  });

  return authKeys;
}

/**
 * Verify that all authentication data has been cleared
 * @returns {Object} Verification result
 */
export function verifyAuthStorageCleared() {
  const remainingKeys = getAuthStorageKeys();
  const isCleared = remainingKeys.localStorage.length === 0 && remainingKeys.sessionStorage.length === 0;

  const result = {
    isCleared,
    remainingKeys,
    totalRemaining: remainingKeys.localStorage.length + remainingKeys.sessionStorage.length
  };

  if (isCleared) {
    console.log('✅ All authentication storage successfully cleared');
  } else {
    console.warn('⚠️ Some authentication data may still remain:', remainingKeys);
  }

  return result;
}