/**
 * Browser Notifications Utility
 * Handles browser notification permissions and display for @mentions
 */

import { browser } from '$app/environment';

/**
 * Request notification permission from the user
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  if (!browser || !('Notification' in window)) {
    console.warn('Browser notifications not supported');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Check if browser notifications are supported and permitted
 * @returns {boolean} True if notifications can be shown
 */
export function canShowNotifications() {
  return (
    browser &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
}

/**
 * Show a browser notification for a mention
 * @param {Object} mentionData - The mention data
 * @param {string} mentionData.mentionedByNickname - Who mentioned the user
 * @param {string} mentionData.roomName - Which room the mention occurred in
 * @param {string} mentionData.messageContent - The message content
 * @param {string} mentionData.mentionedByAvatar - Avatar URL of the mentioner (optional)
 * @param {Function} onClick - Callback when notification is clicked (optional)
 */
export function showMentionNotification(mentionData, onClick = null) {
  if (!canShowNotifications()) {
    return null;
  }

  const {
    mentionedByNickname,
    roomName,
    messageContent,
    mentionedByAvatar
  } = mentionData;

  const title = `${mentionedByNickname} mentioned you in ${roomName}`;
  const body = truncateMessage(messageContent, 100);

  const options = {
    body,
    icon: mentionedByAvatar || '/favicon.png',
    badge: '/favicon.png',
    tag: 'chat-mention', // This will replace previous mention notifications
    requireInteraction: false,
    silent: false,
    timestamp: Date.now(),
    data: {
      type: 'mention',
      roomName,
      mentionedBy: mentionedByNickname,
      messageContent
    }
  };

  try {
    const notification = new Notification(title, options);

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle click event
    if (onClick) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus(); // Focus the browser window
        onClick(mentionData);
        notification.close();
      };
    }

    // Handle error event
    notification.onerror = (error) => {
      console.error('Notification error:', error);
    };

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

/**
 * Truncate message content for notification display
 * @param {string} message - The message to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated message
 */
function truncateMessage(message, maxLength = 100) {
  if (!message || message.length <= maxLength) {
    return message || '';
  }
  
  return message.substring(0, maxLength - 3) + '...';
}

/**
 * Show a test notification to verify permissions
 * @returns {Notification|null} The notification object or null
 */
export function showTestNotification() {
  if (!canShowNotifications()) {
    return null;
  }

  return showMentionNotification({
    mentionedByNickname: 'System',
    roomName: 'Test',
    messageContent: 'Browser notifications are working! You\'ll now receive notifications when someone mentions you.',
    mentionedByAvatar: '/favicon.png'
  });
}

/**
 * Get notification permission status
 * @returns {string} Permission status
 */
export function getNotificationPermission() {
  if (!browser || !('Notification' in window)) {
    return 'unsupported';
  }
  
  return Notification.permission;
}

/**
 * Check if the user has previously denied notifications
 * @returns {boolean} True if notifications were denied
 */
export function isNotificationDenied() {
  return getNotificationPermission() === 'denied';
}

/**
 * Check if notification permission is still pending
 * @returns {boolean} True if permission is pending
 */
export function isNotificationPending() {
  return getNotificationPermission() === 'default';
}