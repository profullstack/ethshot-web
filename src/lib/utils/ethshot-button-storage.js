/**
 * LocalStorage operations for GameButton component
 * Handles saving and retrieving shot secrets and related data
 */

/**
 * Save a secret to localStorage
 * @param {string} secret - The secret to save
 * @param {string} txHash - Transaction hash
 * @param {string} walletAddress - Wallet address
 * @returns {boolean} Success status
 */
export const saveSecretToStorage = (secret, txHash, walletAddress) => {
  try {
    const secretData = {
      secret,
      txHash,
      walletAddress,
      timestamp: Date.now(),
      blockNumber: null // Will be filled when we get block info
    };

    // Create a unique key for this secret
    const secretKey = `ethshot_secret_${walletAddress}_${txHash.slice(0, 10)}`;
    
    // Save to localStorage
    localStorage.setItem(secretKey, JSON.stringify(secretData));
    
    // Also maintain a list of all saved secrets for this wallet
    const savedSecretsKey = `ethshot_saved_secrets_${walletAddress}`;
    const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    
    // Add this secret to the list if not already there
    if (!existingSecrets.includes(secretKey)) {
      existingSecrets.push(secretKey);
      localStorage.setItem(savedSecretsKey, JSON.stringify(existingSecrets));
    }
    
    console.log('💾 Secret saved to localStorage:', secretKey);
    return true;
  } catch (error) {
    console.error('❌ Failed to save secret to localStorage:', error);
    return false;
  }
};

/**
 * Get all saved secrets for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {Array} Array of secret data objects
 */
export const getSavedSecrets = (walletAddress) => {
  try {
    if (!walletAddress) return [];

    // Get the list of saved secrets for this wallet
    const savedSecretsKey = `ethshot_saved_secrets_${walletAddress}`;
    let savedSecretKeys = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    
    // Filter out any invalid or expired secrets
    const validSecrets = [];
    const validKeys = [];
    
    for (const key of savedSecretKeys) {
      try {
        const secretDataStr = localStorage.getItem(key);
        if (!secretDataStr) continue;
        
        const secretData = JSON.parse(secretDataStr);
        // Basic validation - check if required fields exist
        if (secretData.secret && secretData.txHash && secretData.walletAddress === walletAddress) {
          validSecrets.push(secretData);
          validKeys.push(key);
        }
      } catch (e) {
        // Skip invalid entries
        console.warn('Invalid secret entry found:', key, e);
      }
    }
    
    // Update the saved secrets list in localStorage if it changed
    if (validKeys.length !== savedSecretKeys.length) {
      localStorage.setItem(savedSecretsKey, JSON.stringify(validKeys));
    }
    
    return validSecrets;
  } catch (error) {
    console.error('❌ Failed to get saved secrets from localStorage:', error);
    return [];
  }
};

/**
 * Get the most recent saved secret for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {Object|null} Most recent secret data or null
 */
export const getMostRecentSecret = (walletAddress) => {
  const savedSecrets = getSavedSecrets(walletAddress);
  if (savedSecrets.length === 0) return null;
  
  // Sort by timestamp and return the most recent
  savedSecrets.sort((a, b) => b.timestamp - a.timestamp);
  return savedSecrets[0];
};

/**
 * Remove a revealed secret from localStorage
 * @param {string} walletAddress - Wallet address
 * @param {string} txHash - Transaction hash of the revealed secret
 * @returns {boolean} Success status
 */
export const removeRevealedSecret = (walletAddress, txHash) => {
  try {
    if (!walletAddress || !txHash) return false;

    const savedSecretsKey = `ethshot_saved_secrets_${walletAddress}`;
    const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    
    // Filter out the revealed secret
    const updatedSecrets = existingSecrets.filter(key => {
      const secretDataStr = localStorage.getItem(key);
      if (secretDataStr) {
        const secretData = JSON.parse(secretDataStr);
        return secretData.txHash !== txHash;
      }
      return true;
    });
    
    // Update the saved secrets list
    localStorage.setItem(savedSecretsKey, JSON.stringify(updatedSecrets));
    
    // Also remove the individual secret entry
    const secretKey = `ethshot_secret_${walletAddress}_${txHash.slice(0, 10)}`;
    localStorage.removeItem(secretKey);
    
    console.log('🗑️ Removed revealed secret from localStorage:', secretKey);
    return true;
  } catch (error) {
    console.error('❌ Failed to remove revealed secret from localStorage:', error);
    return false;
  }
};

/**
 * Copy secret to clipboard
 * @param {string} secret - Secret to copy
 * @returns {Promise<boolean>} Success status
 */
export const copySecretToClipboard = async (secret) => {
  try {
    await navigator.clipboard.writeText(secret);
    return true;
  } catch (error) {
    console.error('❌ Failed to copy secret to clipboard:', error);
    return false;
  }
};

/**
 * Check for saved secrets and return the most recent one (excluding first shots)
 * @param {string} walletAddress - Wallet address
 * @returns {Object|null} Most recent secret data or null
 */
export const checkForSavedSecrets = (walletAddress) => {
  try {
    if (!walletAddress) return null;

    const savedSecrets = getSavedSecrets(walletAddress);
    if (savedSecrets.length === 0) return null;
    
    // Filter out first shots - they should never show the reveal modal
    const regularShots = savedSecrets.filter(secret => {
      // If isFirstShot is explicitly false, it's a regular shot
      // If isFirstShot is undefined (old data), assume it's a regular shot
      // If isFirstShot is true, exclude it
      return secret.isFirstShot !== true;
    });
    
    if (regularShots.length === 0) return null;
    
    // Sort by timestamp and return the most recent regular shot
    regularShots.sort((a, b) => b.timestamp - a.timestamp);
    const mostRecentSecret = regularShots[0];
    
    console.log('💾 Found saved secret in localStorage for wallet:', walletAddress, '(excluding first shots)');
    return mostRecentSecret;
  } catch (error) {
    console.error('❌ Failed to check for saved secrets in localStorage:', error);
    return null;
  }
};

/**
 * Clear all saved secrets for a wallet (useful for cleanup)
 * @param {string} walletAddress - Wallet address
 * @returns {boolean} Success status
 */
export const clearAllSecrets = (walletAddress) => {
  try {
    if (!walletAddress) return false;

    const savedSecretsKey = `ethshot_saved_secrets_${walletAddress}`;
    const existingSecrets = JSON.parse(localStorage.getItem(savedSecretsKey) || '[]');
    
    // Remove all individual secret entries
    for (const key of existingSecrets) {
      localStorage.removeItem(key);
    }
    
    // Clear the secrets list
    localStorage.removeItem(savedSecretsKey);
    
    console.log('🧹 Cleared all saved secrets for wallet:', walletAddress);
    return true;
  } catch (error) {
    console.error('❌ Failed to clear saved secrets:', error);
    return false;
  }
};