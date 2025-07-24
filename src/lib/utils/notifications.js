/**
 * Browser Notification System for ETH Shot
 * Handles permission requests and sends viral notifications
 */

import { browser } from '$app/environment';
import { SOCIAL_CONFIG } from '../config.js';

class NotificationManager {
  constructor() {
    this.permission = null;
    this.isSupported = false;
    this.init();
  }

  init() {
    if (!browser) return;
    
    this.isSupported = 'Notification' in window;
    if (this.isSupported) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request notification permission from user
   * @returns {Promise<string>} Permission status
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Notifications not supported in this browser');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Send a notification if permission is granted
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   */
  async sendNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      return false;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'ethshot-game',
      requireInteraction: true,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Handle click to focus window
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Optional: navigate to specific page
        if (options.url) {
          window.location.href = options.url;
        }
      };

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Notify when cooldown period is over
   * @param {number} cooldownHours - Hours the user waited
   */
  async notifyCooldownComplete(cooldownHours = 1) {
    const title = '🎯 Your shot is ready!';
    const body = `Your ${cooldownHours}h cooldown is over. Take your shot at the jackpot!`;
    
    return this.sendNotification(title, {
      body,
      icon: '🎯',
      tag: 'cooldown-complete',
      url: SOCIAL_CONFIG.APP_URL
    });
  }

  /**
   * Notify when someone wins the jackpot
   * @param {string} amount - Amount won in ETH
   * @param {string} winner - Winner address (optional)
   */
  async notifyJackpotWon(amount, winner = null) {
    const title = '🎉 JACKPOT WON!';
    const winnerText = winner ? ` by ${winner.slice(0, 6)}...${winner.slice(-4)}` : '';
    const body = `Someone just won ${amount} ETH${winnerText}! The pot resets - take your shot now!`;
    
    return this.sendNotification(title, {
      body,
      icon: '🎉',
      tag: 'jackpot-won',
      url: SOCIAL_CONFIG.APP_URL
    });
  }

  /**
   * Notify when someone takes a shot
   * @param {string} newPotAmount - New pot amount in ETH
   */
  async notifyShotTaken(newPotAmount) {
    const title = '💥 Shot fired!';
    const body = `Someone just took a shot! Pot is now ${newPotAmount} ETH. Your turn?`;
    
    return this.sendNotification(title, {
      body,
      icon: '💥',
      tag: 'shot-taken',
      url: SOCIAL_CONFIG.APP_URL
    });
  }

  /**
   * Notify about pot milestones
   * @param {string} milestone - Milestone amount (e.g., "1 ETH", "5 ETH")
   */
  async notifyPotMilestone(milestone) {
    const title = '🚀 Pot Milestone!';
    const body = `The jackpot just hit ${milestone}! This is getting exciting...`;
    
    return this.sendNotification(title, {
      body,
      icon: '🚀',
      tag: 'pot-milestone',
      url: SOCIAL_CONFIG.APP_URL
    });
  }

  /**
   * Notify about urgent opportunities
   * @param {string} message - Custom urgent message
   */
  async notifyUrgent(message) {
    const title = '⚡ ETH Shot Alert!';
    
    return this.sendNotification(title, {
      body: message,
      icon: '⚡',
      tag: 'urgent-alert',
      requireInteraction: true,
      url: SOCIAL_CONFIG.APP_URL
    });
  }

  /**
   * Schedule a notification for when cooldown ends
   * @param {number} cooldownSeconds - Seconds until cooldown ends
   */
  scheduleCooldownNotification(cooldownSeconds) {
    if (cooldownSeconds <= 0) return;

    // Clear any existing cooldown timer
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }

    // Schedule notification
    this.cooldownTimer = setTimeout(() => {
      this.notifyCooldownComplete();
    }, cooldownSeconds * 1000);

    console.log(`🔔 Cooldown notification scheduled for ${cooldownSeconds} seconds`);
  }

  /**
   * Clear scheduled notifications
   */
  clearScheduledNotifications() {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  /**
   * Check if notifications are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.isSupported && this.permission === 'granted';
  }

  /**
   * Get permission status for UI display
   * @returns {string} 'granted', 'denied', 'default', or 'unsupported'
   */
  getPermissionStatus() {
    if (!this.isSupported) return 'unsupported';
    return this.permission || 'default';
  }
}

// Create singleton instance
export const notificationManager = new NotificationManager();

// Convenience functions for easy importing
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const notifyCooldownComplete = (hours) => notificationManager.notifyCooldownComplete(hours);
export const notifyJackpotWon = (amount, winner) => notificationManager.notifyJackpotWon(amount, winner);
export const notifyShotTaken = (amount) => notificationManager.notifyShotTaken(amount);
export const notifyPotMilestone = (milestone) => notificationManager.notifyPotMilestone(milestone);
export const notifyUrgent = (message) => notificationManager.notifyUrgent(message);
export const scheduleCooldownNotification = (seconds) => notificationManager.scheduleCooldownNotification(seconds);
export const isNotificationsEnabled = () => notificationManager.isEnabled();
export const getNotificationPermissionStatus = () => notificationManager.getPermissionStatus();