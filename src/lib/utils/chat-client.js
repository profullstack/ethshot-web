/**
 * WebSocket Chat Client
 * Handles client-side WebSocket communication for real-time chat
 */

import { browser } from '$app/environment';
import { CHAT_CONFIG } from '$lib/config/chat.js';

const CHAT_SERVER_URL = CHAT_CONFIG.SERVER_URL;
const RECONNECT_INTERVAL = 5000; // 5 seconds
const PING_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export class ChatClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.walletAddress = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.messageHandlers = new Map();
    this.eventListeners = new Map();
  }

  /**
   * Connect to the chat server
   */
  async connect() {
    if (!browser) return false;

    try {
      this.ws = new WebSocket(CHAT_SERVER_URL);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('Connected to chat server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPing();
          this.emit('connected');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('Disconnected from chat server:', event.code, event.reason);
          this.isConnected = false;
          this.isAuthenticated = false;
          this.stopPing();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Attempt to reconnect if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };
      });
    } catch (error) {
      console.error('Failed to connect to chat server:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Disconnect from the chat server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopPing();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Authenticate with wallet address
   */
  async authenticate(walletAddress) {
    if (!this.isConnected) {
      throw new Error('Not connected to chat server');
    }

    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }

    this.walletAddress = walletAddress;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeMessageHandler('authenticated');
        this.removeMessageHandler('error');
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.addMessageHandler('authenticated', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('authenticated');
        this.removeMessageHandler('error');
        this.isAuthenticated = true;
        this.emit('authenticated', data);
        resolve(data);
      });

      this.addMessageHandler('error', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('authenticated');
        this.removeMessageHandler('error');
        reject(new Error(data.message));
      });

      this.send({
        type: 'authenticate',
        walletAddress
      });
    });
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeMessageHandler('room_joined');
        this.removeMessageHandler('error');
        reject(new Error('Join room timeout'));
      }, 10000);

      this.addMessageHandler('room_joined', (data) => {
        if (data.roomId === roomId) {
          clearTimeout(timeout);
          this.removeMessageHandler('room_joined');
          this.removeMessageHandler('error');
          this.emit('room_joined', data);
          resolve(data);
        }
      });

      this.addMessageHandler('error', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('room_joined');
        this.removeMessageHandler('error');
        reject(new Error(data.message));
      });

      this.send({
        type: 'join_room',
        roomId
      });
    });
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeMessageHandler('room_left');
        this.removeMessageHandler('error');
        reject(new Error('Leave room timeout'));
      }, 10000);

      this.addMessageHandler('room_left', (data) => {
        if (data.roomId === roomId) {
          clearTimeout(timeout);
          this.removeMessageHandler('room_left');
          this.removeMessageHandler('error');
          this.emit('room_left', data);
          resolve(data);
        }
      });

      this.addMessageHandler('error', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('room_left');
        this.removeMessageHandler('error');
        reject(new Error(data.message));
      });

      this.send({
        type: 'leave_room',
        roomId
      });
    });
  }

  /**
   * Send a message to a room
   */
  async sendMessage(roomId, content, messageType = 'text') {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    this.send({
      type: 'send_message',
      roomId,
      content: content.trim(),
      messageType
    });
  }

  /**
   * Get message history for a room
   */
  async getMessages(roomId, limit = 50, offset = 0) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeMessageHandler('message_history');
        this.removeMessageHandler('error');
        reject(new Error('Get messages timeout'));
      }, 10000);

      this.addMessageHandler('message_history', (data) => {
        if (data.roomId === roomId) {
          clearTimeout(timeout);
          this.removeMessageHandler('message_history');
          this.removeMessageHandler('error');
          resolve(data.messages);
        }
      });

      this.addMessageHandler('error', (data) => {
        clearTimeout(timeout);
        this.removeMessageHandler('message_history');
        this.removeMessageHandler('error');
        reject(new Error(data.message));
      });

      this.send({
        type: 'get_messages',
        roomId,
        limit,
        offset
      });
    });
  }

  /**
   * Send a message to the server
   */
  send(message) {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    if (!this.isConnected) {
      throw new Error('Not connected to chat server');
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket connection is not open (state: ${this.ws.readyState})`);
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle specific message types
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Emit general message event
      this.emit('message', message);

      // Handle specific message types for general events
      switch (message.type) {
        case 'new_message':
          this.emit('new_message', message);
          break;
        case 'user_joined':
          this.emit('user_joined', message);
          break;
        case 'user_left':
          this.emit('user_left', message);
          break;
        case 'pong':
          // Handle ping/pong for keep-alive
          break;
        case 'error':
          this.emit('chat_error', message);
          break;
      }

    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Add a message handler for a specific message type
   */
  addMessageHandler(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type).add(handler);
  }

  /**
   * Remove a message handler
   */
  removeMessageHandler(type, handler = null) {
    if (handler) {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    } else {
      this.messageHandlers.delete(type);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data = null) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Start ping timer for keep-alive
   */
  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, PING_INTERVAL);
  }

  /**
   * Stop ping timer
   */
  stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      walletAddress: this.walletAddress,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
let chatClientInstance = null;

export function getChatClient() {
  if (!chatClientInstance) {
    chatClientInstance = new ChatClient();
  }
  return chatClientInstance;
}

export default ChatClient;