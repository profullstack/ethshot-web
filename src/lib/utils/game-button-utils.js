/**
 * Utility functions for GameButton component
 * Handles time formatting, status updates, and timer management
 */

import { GAME_CONFIG } from '../config.js';

/**
 * Format time remaining for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (seconds) => {
  if (seconds <= 0) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

/**
 * Create a status update handler function
 * @param {Function} setTransactionStatus - Function to set transaction status
 * @param {Function} setStatusMessage - Function to set status message
 * @param {Function} setProgressPercentage - Function to set progress percentage
 * @returns {Function} Status update handler
 */
export const createStatusUpdateHandler = (setTransactionStatus, setStatusMessage, setProgressPercentage) => {
  const statusProgress = {
    'idle': 0,
    'preparing': 5,
    'checking_balance': 10,
    'estimating_gas': 15,
    'generating_commitment': 20,
    'sending_transaction': 25,
    'waiting_confirmation': 35,
    'processing': 40,
    'logging_database': 45,
    'refreshing_state': 50,
    'waiting_reveal_window': 52,
    'preparing_reveal': 55,
    'checking_pending': 60,
    'estimating_reveal_gas': 65,
    'sending_reveal': 70,
    'waiting_reveal_confirmation': 80,
    'processing_reveal': 85,
    'refreshing_reveal_state': 90,
    'reveal_completed': 95,
    'completed': 100
  };

  return (status, message) => {
    setTransactionStatus(status);
    setStatusMessage(message);
    
    const progressPercentage = statusProgress[status] || 0;
    setProgressPercentage(progressPercentage);
    
    console.log(`🎯 Transaction Status: ${status} - ${message} (${progressPercentage}%)`);
  };
};

/**
 * Create a cooldown timer manager
 * @param {Function} getCooldownRemaining - Function to get cooldown remaining
 * @param {Function} setTimeRemaining - Function to set time remaining
 * @param {Function} onCooldownExpired - Function to call when cooldown expires
 * @returns {Object} Timer manager with start and stop methods
 */
export const createCooldownTimer = (getCooldownRemaining, setTimeRemaining, onCooldownExpired) => {
  let cooldownTimer = null;

  const start = () => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
    }

    cooldownTimer = setInterval(async () => {
      const timeRemaining = getCooldownRemaining();
      setTimeRemaining(timeRemaining);
      
      if (timeRemaining <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        
        // Call the expired callback
        if (onCooldownExpired) {
          await onCooldownExpired();
        }
      }
    }, 1000);
  };

  const stop = () => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  };

  return { start, stop };
};

/**
 * Calculate progress percentage for cooldown
 * @param {number} timeRemaining - Time remaining in milliseconds
 * @param {number} totalCooldownSeconds - Total cooldown time in seconds
 * @returns {number} Progress percentage (0-100)
 */
export const calculateCooldownProgress = (timeRemaining, totalCooldownSeconds = GAME_CONFIG.COOLDOWN_SECONDS) => {
  return Math.max(0, 100 - (timeRemaining / (totalCooldownSeconds * 1000)) * 100);
};

/**
 * Reset transaction status to idle
 * @param {Function} setTransactionStatus - Function to set transaction status
 * @param {Function} setStatusMessage - Function to set status message
 * @param {Function} setProgressPercentage - Function to set progress percentage
 * @param {number} delay - Delay in milliseconds before reset (default: 2000)
 */
export const resetTransactionStatus = (setTransactionStatus, setStatusMessage, setProgressPercentage, delay = 2000) => {
  setTimeout(() => {
    setTransactionStatus('idle');
    setStatusMessage('');
    setProgressPercentage(0);
  }, delay);
};

/**
 * Set cooldown status
 * @param {Function} setTransactionStatus - Function to set transaction status
 * @param {Function} setStatusMessage - Function to set status message
 * @param {Function} setProgressPercentage - Function to set progress percentage
 * @param {string} message - Status message
 * @param {number} progress - Progress percentage
 */
export const setCooldownStatus = (setTransactionStatus, setStatusMessage, setProgressPercentage, message, progress) => {
  setTransactionStatus('cooldown');
  setStatusMessage(message);
  setProgressPercentage(progress);
};