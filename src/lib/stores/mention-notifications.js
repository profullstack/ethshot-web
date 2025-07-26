/**
 * Chat Mention Notifications Store
 * Manages @mention notifications and unread counts using Svelte stores
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabase.js';
import {
  showMentionNotification,
  requestNotificationPermission,
  canShowNotifications
} from '$lib/utils/browser-notifications.js';
import { chatVisible } from '$lib/stores/chat.js';

// Core stores for mention notifications
export const mentionNotifications = writable([]);
export const pendingMentions = writable(new Map());

// Derived stores for computed values
export const totalPendingMentions = derived(
  pendingMentions,
  ($pendingMentions) => $pendingMentions.size
);

export const roomPendingMentions = derived(
  pendingMentions,
  ($pendingMentions) => {
    const roomCounts = new Map();
    
    for (const mention of $pendingMentions.values()) {
      const currentCount = roomCounts.get(mention.roomId) || 0;
      roomCounts.set(mention.roomId, currentCount + 1);
    }
    
    return roomCounts;
  }
);

/**
 * Add a new mention notification
 * @param {Object} mention - The mention notification object
 */
export function addMentionNotification(mention) {
  if (!mention || !mention.id) {
    console.warn('Invalid mention notification:', mention);
    return;
  }

  // Check if mention already exists
  const currentPending = get(pendingMentions);
  if (currentPending.has(mention.id)) {
    return; // Don't add duplicates
  }

  // Add to notifications list
  mentionNotifications.update(notifications => {
    // Remove existing mention with same ID if it exists
    const filtered = notifications.filter(n => n.id !== mention.id);
    
    // Add new mention and sort by creation date (newest first)
    const updated = [...filtered, mention];
    updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return updated;
  });

  // Add to pending mentions if not read
  if (!mention.isRead) {
    pendingMentions.update(pending => {
      const updated = new Map(pending);
      updated.set(mention.id, mention);
      return updated;
    });

    // Show browser notification if chat is not visible or user is not in the room
    const isChatVisible = get(chatVisible);
    if (!isChatVisible && canShowNotifications()) {
      showMentionNotification({
        mentionedByNickname: mention.mentionedByNickname,
        roomName: mention.roomName,
        messageContent: mention.messageContent,
        mentionedByAvatar: mention.mentionedByAvatar
      }, (mentionData) => {
        // When notification is clicked, open chat and focus on the room
        // This callback will be handled by the ChatWidget component
        console.log('Mention notification clicked:', mentionData);
      });
    }
  }
}

/**
 * Mark a specific mention as read
 * @param {string} mentionId - The ID of the mention to mark as read
 */
export function markMentionAsRead(mentionId) {
  if (!mentionId) return;

  // Update the mention in the notifications list
  mentionNotifications.update(notifications => {
    return notifications.map(mention => {
      if (mention.id === mentionId) {
        return { ...mention, isRead: true };
      }
      return mention;
    });
  });

  // Remove from pending mentions
  pendingMentions.update(pending => {
    const updated = new Map(pending);
    updated.delete(mentionId);
    return updated;
  });
}

/**
 * Mark all mentions in a specific room as read
 * @param {string} roomId - The ID of the room
 */
export function markRoomMentionsAsRead(roomId) {
  if (!roomId) return;

  const currentNotifications = get(mentionNotifications);
  const roomMentions = currentNotifications.filter(m => m.roomId === roomId && !m.isRead);

  // Mark each mention as read
  roomMentions.forEach(mention => {
    markMentionAsRead(mention.id);
  });
}

/**
 * Get mentions for a specific room
 * @param {string} roomId - The room ID
 * @param {boolean} unreadOnly - Whether to return only unread mentions
 * @returns {Array} Array of mentions for the room
 */
export function getMentionsByRoom(roomId, unreadOnly = false) {
  if (!roomId) return [];

  const notifications = get(mentionNotifications);
  let roomMentions = notifications.filter(mention => mention.roomId === roomId);

  if (unreadOnly) {
    roomMentions = roomMentions.filter(mention => !mention.isRead);
  }

  // Sort by creation date (newest first)
  roomMentions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return roomMentions;
}

/**
 * Clear all mention notifications
 */
export function clearAllMentions() {
  mentionNotifications.set([]);
  pendingMentions.set(new Map());
}

/**
 * Load unread mentions from the database
 * @param {string} userWalletAddress - The user's wallet address
 */
export async function loadUnreadMentions(userWalletAddress) {
  if (!browser || !userWalletAddress) return;

  try {
    // Set the current user context for RLS policies
    await supabase.rpc('set_config', {
      setting_name: 'app.current_user_wallet',
      setting_value: userWalletAddress.toLowerCase(),
      is_local: true
    });

    // Call the database function to get unread mentions
    const { data: mentions, error } = await supabase
      .rpc('get_unread_mentions', {
        p_user_wallet_address: userWalletAddress.toLowerCase()
      });

    if (error) {
      console.error('Error loading unread mentions:', error);
      return;
    }

    if (mentions && mentions.length > 0) {
      // Clear existing mentions and add loaded ones
      clearAllMentions();
      
      mentions.forEach(mention => {
        addMentionNotification({
          id: mention.id,
          messageId: mention.message_id,
          roomId: mention.room_id,
          roomName: mention.room_name,
          mentionedByWallet: mention.mentioned_by_wallet,
          mentionedByNickname: mention.mentioned_by_nickname,
          messageContent: mention.message_content,
          createdAt: mention.created_at,
          isRead: false
        });
      });
    }
  } catch (error) {
    console.error('Failed to load unread mentions:', error);
    throw error;
  }
}

/**
 * Mark mentions as read in the database
 * @param {string} userWalletAddress - The user's wallet address
 * @param {string} roomId - Optional room ID to mark only mentions from that room
 */
export async function markMentionsAsReadInDatabase(userWalletAddress, roomId = null) {
  if (!browser || !userWalletAddress) return;

  try {
    // Set the current user context for RLS policies
    await supabase.rpc('set_config', {
      setting_name: 'app.current_user_wallet',
      setting_value: userWalletAddress.toLowerCase(),
      is_local: true
    });

    // Call the database function to mark mentions as read
    const { data, error } = await supabase
      .rpc('mark_mentions_as_read', {
        p_user_wallet_address: userWalletAddress.toLowerCase(),
        p_room_id: roomId
      });

    if (error) {
      console.error('Error marking mentions as read:', error);
      return;
    }

    return data;
  } catch (error) {
    console.error('Failed to mark mentions as read in database:', error);
    throw error;
  }
}

/**
 * Get mention count from database
 * @param {string} userWalletAddress - The user's wallet address
 * @param {string} roomId - Optional room ID to get count for specific room
 * @returns {number} Number of unread mentions
 */
export async function getMentionCountFromDatabase(userWalletAddress, roomId = null) {
  if (!browser || !userWalletAddress) return 0;

  try {
    // Set the current user context for RLS policies
    await supabase.rpc('set_config', {
      setting_name: 'app.current_user_wallet',
      setting_value: userWalletAddress.toLowerCase(),
      is_local: true
    });

    // Call the database function to get mention count
    const { data: count, error } = await supabase
      .rpc('get_mention_count', {
        p_user_wallet_address: userWalletAddress.toLowerCase(),
        p_room_id: roomId
      });

    if (error) {
      console.error('Error getting mention count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Failed to get mention count from database:', error);
    return 0;
  }
}

/**
 * Search for nicknames in a room (for autocomplete)
 * @param {string} query - The search query
 * @param {string} roomId - The room ID
 * @param {number} limit - Maximum number of results
 * @returns {Array} Array of user objects with nickname, wallet_address, avatar_url
 */
export async function searchNicknamesInRoom(query, roomId, limit = 10) {
  if (!browser || !query || !roomId) return [];

  try {
    const { data: users, error } = await supabase
      .rpc('search_nicknames_for_mention', {
        p_query: query,
        p_room_id: roomId,
        p_limit: limit
      });

    if (error) {
      console.error('Error searching nicknames:', error);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('Failed to search nicknames:', error);
    return [];
  }
}

// Auto-load mentions when wallet address changes
let currentWalletAddress = null;

/**
 * Initialize mention notifications for a user
 * @param {string} walletAddress - The user's wallet address
 */
export async function initializeMentionNotifications(walletAddress) {
  if (currentWalletAddress === walletAddress) return;
  
  currentWalletAddress = walletAddress;
  
  if (walletAddress) {
    try {
      await loadUnreadMentions(walletAddress);
    } catch (error) {
      console.error('Failed to initialize mention notifications:', error);
    }
  } else {
    clearAllMentions();
  }
}

/**
 * Handle new mention from real-time updates
 * @param {Object} mentionData - The mention data from real-time subscription
 */
export function handleNewMentionFromRealtime(mentionData) {
  if (!mentionData) return;

  const mention = {
    id: mentionData.id,
    messageId: mentionData.message_id,
    roomId: mentionData.room_id,
    roomName: mentionData.room_name || 'Unknown Room',
    mentionedByWallet: mentionData.mentioned_by_wallet,
    mentionedByNickname: mentionData.mentioned_by_nickname || 'Unknown User',
    messageContent: mentionData.message_content,
    createdAt: mentionData.created_at,
    isRead: false
  };

  addMentionNotification(mention);
}

/**
 * Request notification permissions and show test notification
 * @returns {Promise<boolean>} True if permissions were granted
 */
export async function enableBrowserNotifications() {
  try {
    const permission = await requestNotificationPermission();
    
    if (permission === 'granted') {
      // Show a test notification to confirm it's working
      setTimeout(() => {
        showMentionNotification({
          mentionedByNickname: 'System',
          roomName: 'Test',
          messageContent: 'Browser notifications are now enabled! You\'ll receive notifications when someone mentions you.',
          mentionedByAvatar: '/favicon.png'
        });
      }, 500);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to enable browser notifications:', error);
    return false;
  }
}