/**
 * Chat System Configuration
 * Centralized configuration for the chat system
 */

import { browser } from '$app/environment';

// Environment variables with fallbacks
const getEnvVar = (name, fallback) => {
  if (browser) {
    // In browser, use Vite environment variables
    return import.meta.env[name] || fallback;
  }
  return process.env[name] || fallback;
};

export const CHAT_CONFIG = {
  // WebSocket server configuration
  SERVER_URL: getEnvVar('VITE_CHAT_SERVER_URL', 'ws://localhost:8080/chat'),
  SERVER_PORT: parseInt(getEnvVar('CHAT_SERVER_PORT', '8080')),
  
  // Connection settings
  RECONNECT_INTERVAL: 5000, // 5 seconds
  PING_INTERVAL: 30000, // 30 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  CONNECTION_TIMEOUT: 10000, // 10 seconds
  
  // Message settings
  MAX_MESSAGE_LENGTH: 500,
  MESSAGE_HISTORY_LIMIT: 50,
  MESSAGE_PAGINATION_SIZE: 25,
  
  // Rate limiting
  RATE_LIMIT_MESSAGES: 10, // messages per window
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  
  // UI settings
  DEFAULT_CHAT_VISIBLE: false,
  DEFAULT_CHAT_MINIMIZED: false,
  NOTIFICATION_SOUND_ENABLED: true,
  SHOW_TIMESTAMPS_DEFAULT: true,
  
  // Room settings
  DEFAULT_ROOMS: [
    {
      id: 'global',
      name: 'Global Chat',
      type: 'global',
      description: 'General discussion for all players',
      maxUsers: 100,
      autoJoin: true
    },
    {
      id: 'trash-talk',
      name: 'Trash Talk',
      type: 'global',
      description: 'Let the trash talking begin!',
      maxUsers: 50,
      autoJoin: false
    },
    {
      id: 'game-discussion',
      name: 'Game Discussion',
      type: 'game',
      description: 'Discuss game strategies and tips',
      maxUsers: 75,
      autoJoin: false
    }
  ],
  
  // Moderation settings
  PROFANITY_FILTER_ENABLED: true,
  SPAM_DETECTION_ENABLED: true,
  MAX_DUPLICATE_MESSAGES: 3,
  MUTE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  // Feature flags
  FEATURES: {
    CHAT_ENABLED: getEnvVar('CHAT_ENABLED', 'true') === 'true',
    VOICE_CHAT_ENABLED: false,
    FILE_SHARING_ENABLED: false,
    EMOJI_REACTIONS_ENABLED: true,
    PRIVATE_MESSAGES_ENABLED: false,
    ROOM_CREATION_ENABLED: false
  },
  
  // Styling
  THEME: {
    PRIMARY_COLOR: '#3b82f6',
    SUCCESS_COLOR: '#10b981',
    ERROR_COLOR: '#ef4444',
    WARNING_COLOR: '#f59e0b',
    BACKGROUND_OPACITY: 0.95,
    BLUR_AMOUNT: '10px'
  }
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  SYSTEM: 'system',
  EMOTE: 'emote',
  JOIN: 'join',
  LEAVE: 'leave'
};

// Room types
export const ROOM_TYPES = {
  GLOBAL: 'global',
  GAME: 'game',
  PRIVATE: 'private'
};

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  // Client to server
  AUTHENTICATE: 'authenticate',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  GET_MESSAGES: 'get_messages',
  PING: 'ping',
  
  // Server to client
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  NEW_MESSAGE: 'new_message',
  MESSAGE_HISTORY: 'message_history',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  PONG: 'pong',
  ERROR: 'error'
};

// Error codes
export const ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_MESSAGE: 'INVALID_MESSAGE'
};

// Validation functions
export const validateWalletAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateMessage = (content) => {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }
  
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
    return { 
      valid: false, 
      error: `Message too long (max ${CHAT_CONFIG.MAX_MESSAGE_LENGTH} characters)` 
    };
  }
  
  return { valid: true, content: trimmed };
};

export const validateRoomId = (roomId) => {
  return roomId && typeof roomId === 'string' && roomId.length > 0;
};

// Utility functions
export const formatWalletAddress = (address) => {
  if (!address || address.length < 10) return 'Unknown';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const generateClientId = () => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Profanity filter (basic implementation)
const PROFANITY_WORDS = [
  // Add profanity words here - keeping it minimal for demo
  'spam', 'scam', 'fake'
];

export const filterProfanity = (message) => {
  if (!CHAT_CONFIG.PROFANITY_FILTER_ENABLED) return message;
  
  let filtered = message;
  PROFANITY_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  
  return filtered;
};

// Spam detection
export const detectSpam = (message, recentMessages = []) => {
  if (!CHAT_CONFIG.SPAM_DETECTION_ENABLED) return false;
  
  // Check for duplicate messages
  const duplicateCount = recentMessages.filter(msg => 
    msg.content.toLowerCase() === message.toLowerCase()
  ).length;
  
  if (duplicateCount >= CHAT_CONFIG.MAX_DUPLICATE_MESSAGES) {
    return true;
  }
  
  // Check for excessive caps
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (capsRatio > 0.7 && message.length > 10) {
    return true;
  }
  
  // Check for excessive repetition
  const repeatedChars = message.match(/(.)\1{4,}/g);
  if (repeatedChars && repeatedChars.length > 0) {
    return true;
  }
  
  return false;
};

export default CHAT_CONFIG;