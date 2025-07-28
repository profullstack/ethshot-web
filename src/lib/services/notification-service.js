/**
 * Notification Service
 * 
 * Pure functions for notification management
 * Wraps the notification manager utility for cleaner API
 */

import { notificationManager } from '../utils/notifications.js';

/**
 * Request notification permission from the user
 * @returns {Promise<string>} Permission status
 */
export const requestNotificationPermission = async () => {
  return await notificationManager.requestPermission();
};

/**
 * Get current notification permission status
 * @returns {string} Permission status ('granted', 'denied', 'default')
 */
export const getNotificationPermissionStatus = () => {
  return notificationManager.getPermissionStatus();
};

/**
 * Check if notifications are enabled
 * @returns {boolean} True if notifications are enabled
 */
export const isNotificationsEnabled = () => {
  return notificationManager.isEnabled();
};

/**
 * Send a notification (if permissions allow)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional notification options
 * @returns {Promise<void>}
 */
export const sendNotification = async (title, body, options = {}) => {
  if (!isNotificationsEnabled()) {
    console.warn('Notifications not enabled, skipping notification');
    return;
  }

  try {
    await notificationManager.show(title, body, options);
  } catch (error) {
    console.error('Failed to send notification:', error);
    throw error;
  }
};