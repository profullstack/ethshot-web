/**
 * Chat Store
 * Manages chat state and WebSocket connection using Svelte stores
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { getChatClient } from '$lib/utils/chat-client.js';
import { supabase } from '$lib/supabase.js';

// Chat connection state
export const chatConnected = writable(false);
export const chatAuthenticated = writable(false);
export const chatError = writable(null);

// Current user and rooms
export const currentWalletAddress = writable(null);
export const joinedRooms = writable(new Set());
export const activeRoom = writable(null);

// Chat rooms and messages
export const chatRooms = writable([]);
export const roomMessages = writable(new Map());
export const onlineUsers = writable(new Map());

// Chat settings
export const chatSettings = writable({
  isEnabled: true,
  showTimestamps: true,
  soundNotifications: true,
  mutedUsers: []
});

// UI state
export const chatVisible = writable(false);
export const chatMinimized = writable(false);
export const unreadMessages = writable(new Map());

// Derived stores
export const hasUnreadMessages = derived(
  unreadMessages,
  ($unreadMessages) => {
    return Array.from($unreadMessages.values()).some(count => count > 0);
  }
);

export const totalUnreadCount = derived(
  unreadMessages,
  ($unreadMessages) => {
    return Array.from($unreadMessages.values()).reduce((total, count) => total + count, 0);
  }
);

class ChatStore {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize the chat system
   */
  async init() {
    if (!browser || this.initialized) return;

    try {
      this.client = getChatClient();
      this.setupEventListeners();
      this.initialized = true;
      
      // Load default chat rooms
      await this.loadChatRooms();
      
      console.log('Chat store initialized');
    } catch (error) {
      console.error('Failed to initialize chat store:', error);
      chatError.set(error.message);
    }
  }

  /**
   * Connect to chat server
   */
  async connect() {
    if (!this.client) {
      await this.init();
    }

    try {
      const connected = await this.client.connect();
      if (connected) {
        chatConnected.set(true);
        chatError.set(null);
      }
      return connected;
    } catch (error) {
      console.error('Failed to connect to chat server:', error);
      chatError.set(error.message);
      return false;
    }
  }

  /**
   * Disconnect from chat server
   */
  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
    
    chatConnected.set(false);
    chatAuthenticated.set(false);
    joinedRooms.set(new Set());
    activeRoom.set(null);
    roomMessages.set(new Map());
    onlineUsers.set(new Map());
  }

  /**
   * Authenticate with wallet address
   */
  async authenticate(walletAddress) {
    if (!this.client) {
      throw new Error('Chat client not initialized');
    }

    try {
      await this.client.authenticate(walletAddress);
      currentWalletAddress.set(walletAddress);
      chatAuthenticated.set(true);
      chatError.set(null);
      
      // Load user chat settings
      await this.loadUserSettings(walletAddress);
      
      return true;
    } catch (error) {
      console.error('Failed to authenticate:', error);
      chatError.set(error.message);
      throw error;
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId) {
    if (!this.client) {
      throw new Error('Chat client not initialized');
    }

    try {
      await this.client.joinRoom(roomId);
      
      // Update joined rooms
      const rooms = get(joinedRooms);
      rooms.add(roomId);
      joinedRooms.set(rooms);
      
      // Set as active room if no active room
      if (!get(activeRoom)) {
        activeRoom.set(roomId);
      }
      
      // Initialize message history for the room
      if (!get(roomMessages).has(roomId)) {
        const messages = get(roomMessages);
        messages.set(roomId, []);
        roomMessages.set(messages);
      }
      
      // Load message history
      await this.loadMessageHistory(roomId);
      
      return true;
    } catch (error) {
      console.error('Failed to join room:', error);
      chatError.set(error.message);
      throw error;
    }
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId) {
    if (!this.client) {
      throw new Error('Chat client not initialized');
    }

    try {
      await this.client.leaveRoom(roomId);
      
      // Update joined rooms
      const rooms = get(joinedRooms);
      rooms.delete(roomId);
      joinedRooms.set(rooms);
      
      // Clear active room if it was the one we left
      if (get(activeRoom) === roomId) {
        const remainingRooms = Array.from(rooms);
        activeRoom.set(remainingRooms.length > 0 ? remainingRooms[0] : null);
      }
      
      // Clear unread messages for this room
      const unread = get(unreadMessages);
      unread.delete(roomId);
      unreadMessages.set(unread);
      
      return true;
    } catch (error) {
      console.error('Failed to leave room:', error);
      chatError.set(error.message);
      throw error;
    }
  }

  /**
   * Send a message to a room
   */
  async sendMessage(roomId, content, messageType = 'text') {
    if (!this.client) {
      throw new Error('Chat client not initialized');
    }

    try {
      await this.client.sendMessage(roomId, content, messageType);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      chatError.set(error.message);
      throw error;
    }
  }

  /**
   * Load message history for a room
   */
  async loadMessageHistory(roomId, limit = 50, offset = 0) {
    if (!this.client) {
      throw new Error('Chat client not initialized');
    }

    try {
      const messages = await this.client.getMessages(roomId, limit, offset);
      
      // Update room messages
      const roomMessagesMap = get(roomMessages);
      const existingMessages = roomMessagesMap.get(roomId) || [];
      
      if (offset === 0) {
        // Replace messages for initial load
        roomMessagesMap.set(roomId, messages);
      } else {
        // Prepend messages for pagination
        roomMessagesMap.set(roomId, [...messages, ...existingMessages]);
      }
      
      roomMessages.set(roomMessagesMap);
      return messages;
    } catch (error) {
      console.error('Failed to load message history:', error);
      chatError.set(error.message);
      throw error;
    }
  }

  /**
   * Load available chat rooms
   */
  async loadChatRooms() {
    try {
      // Fetch actual rooms from the database
      const { data: rooms, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (error) {
        console.error('Error loading chat rooms:', error);
        // Fall back to creating default rooms
        await this.createDefaultRooms();
        return;
      }

      if (rooms && rooms.length > 0) {
        console.log('Loaded chat rooms from database:', rooms);
        chatRooms.set(rooms);
      } else {
        // If no rooms exist, create default ones
        console.log('No rooms found, creating default rooms');
        await this.createDefaultRooms();
      }
    } catch (error) {
      console.error('Error in loadChatRooms:', error);
      // Don't provide fallback rooms - chat requires Supabase
      chatRooms.set([]);
      throw error;
    }
  }

  /**
   * Create default chat rooms in the database
   */
  async createDefaultRooms() {
    try {
      const defaultRooms = [
        {
          name: 'Global Chat',
          type: 'global',
          description: 'General discussion for all players',
          max_users: 100
        },
        {
          name: 'Trash Talk',
          type: 'global',
          description: 'Let the trash talking begin!',
          max_users: 50
        },
        {
          name: 'Game Discussion',
          type: 'game',
          description: 'Discuss game strategies and tips',
          max_users: 75
        }
      ];

      const { data: createdRooms, error } = await supabase
        .from('chat_rooms')
        .insert(defaultRooms)
        .select();

      if (error) {
        console.error('Error creating default rooms:', error);
        return;
      }

      if (createdRooms) {
        chatRooms.set(createdRooms);
        console.log('Created default chat rooms:', createdRooms);
      }
    } catch (error) {
      console.error('Error creating default rooms:', error);
    }
  }

  /**
   * Load user chat settings
   */
  async loadUserSettings(walletAddress) {
    // In a real implementation, you would fetch this from Supabase
    // For now, we'll use default settings
    const defaultSettings = {
      isEnabled: true,
      showTimestamps: true,
      soundNotifications: true,
      mutedUsers: []
    };
    
    chatSettings.set(defaultSettings);
  }

  /**
   * Update chat settings
   */
  async updateSettings(newSettings) {
    const currentSettings = get(chatSettings);
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    chatSettings.set(updatedSettings);
    
    // In a real implementation, you would save this to Supabase
    // await this.saveUserSettings(get(currentWalletAddress), updatedSettings);
  }

  /**
   * Toggle chat visibility
   */
  toggleChat() {
    chatVisible.update(visible => !visible);
  }

  /**
   * Minimize/maximize chat
   */
  toggleMinimize() {
    chatMinimized.update(minimized => !minimized);
  }

  /**
   * Set active room
   */
  setActiveRoom(roomId) {
    activeRoom.set(roomId);
    
    // Clear unread messages for this room
    const unread = get(unreadMessages);
    unread.set(roomId, 0);
    unreadMessages.set(unread);
  }

  /**
   * Add unread message count
   */
  addUnreadMessage(roomId) {
    const currentActiveRoom = get(activeRoom);
    const chatIsVisible = get(chatVisible);
    
    // Don't count as unread if it's the active room and chat is visible
    if (roomId === currentActiveRoom && chatIsVisible) {
      return;
    }
    
    const unread = get(unreadMessages);
    const currentCount = unread.get(roomId) || 0;
    unread.set(roomId, currentCount + 1);
    unreadMessages.set(unread);
  }

  /**
   * Setup event listeners for the chat client
   */
  setupEventListeners() {
    if (!this.client) return;

    // Connection events
    this.client.addEventListener('connected', () => {
      chatConnected.set(true);
      chatError.set(null);
    });

    this.client.addEventListener('disconnected', () => {
      chatConnected.set(false);
      chatAuthenticated.set(false);
    });

    this.client.addEventListener('error', (error) => {
      chatError.set(error.message);
    });

    // Authentication events
    this.client.addEventListener('authenticated', () => {
      chatAuthenticated.set(true);
    });

    // Message events
    this.client.addEventListener('new_message', (message) => {
      this.handleNewMessage(message);
    });

    // Room events
    this.client.addEventListener('user_joined', (data) => {
      this.handleUserJoined(data);
    });

    this.client.addEventListener('user_left', (data) => {
      this.handleUserLeft(data);
    });

    // Error events
    this.client.addEventListener('chat_error', (error) => {
      chatError.set(error.message);
    });
  }

  /**
   * Handle new message
   */
  handleNewMessage(message) {
    const { roomId } = message;
    
    // Add message to room messages
    const messages = get(roomMessages);
    const roomMessageList = messages.get(roomId) || [];
    roomMessageList.push(message);
    messages.set(roomId, roomMessageList);
    roomMessages.set(messages);
    
    // Add to unread count
    this.addUnreadMessage(roomId);
    
    // Play sound notification if enabled
    const settings = get(chatSettings);
    if (settings.soundNotifications && browser) {
      this.playNotificationSound();
    }
  }

  /**
   * Handle user joined room
   */
  handleUserJoined(data) {
    const { roomId, walletAddress } = data;
    
    // Update online users for the room
    const users = get(onlineUsers);
    if (!users.has(roomId)) {
      users.set(roomId, new Set());
    }
    users.get(roomId).add(walletAddress);
    onlineUsers.set(users);
  }

  /**
   * Handle user left room
   */
  handleUserLeft(data) {
    const { roomId, walletAddress } = data;
    
    // Update online users for the room
    const users = get(onlineUsers);
    if (users.has(roomId)) {
      users.get(roomId).delete(walletAddress);
      onlineUsers.set(users);
    }
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    if (!browser) return;
    
    try {
      // Create a simple notification sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }
}

// Create singleton instance
const chatStore = new ChatStore();

// Export store instance and methods
export const chat = {
  init: () => chatStore.init(),
  connect: () => chatStore.connect(),
  disconnect: () => chatStore.disconnect(),
  authenticate: (walletAddress) => chatStore.authenticate(walletAddress),
  joinRoom: (roomId) => chatStore.joinRoom(roomId),
  leaveRoom: (roomId) => chatStore.leaveRoom(roomId),
  sendMessage: (roomId, content, messageType) => chatStore.sendMessage(roomId, content, messageType),
  loadMessageHistory: (roomId, limit, offset) => chatStore.loadMessageHistory(roomId, limit, offset),
  updateSettings: (settings) => chatStore.updateSettings(settings),
  toggleChat: () => chatStore.toggleChat(),
  toggleMinimize: () => chatStore.toggleMinimize(),
  setActiveRoom: (roomId) => chatStore.setActiveRoom(roomId)
};

export default chat;