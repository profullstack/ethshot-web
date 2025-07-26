/**
 * WebSocket Chat Server
 * Handles real-time chat functionality with native WebSocket support
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Chat server configuration
const CHAT_SERVER_PORT = process.env.CHAT_SERVER_PORT || 8080;
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MESSAGES = 10; // messages per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

class ChatServer {
  constructor() {
    this.clients = new Map(); // Map of client connections
    this.rooms = new Map(); // Map of room participants
    this.rateLimits = new Map(); // Rate limiting per user
    this.server = null;
    this.wss = null;
  }

  /**
   * Initialize and start the chat server
   */
  async start() {
    try {
      // Create HTTP server
      this.server = createServer((req, res) => {
        // Health check endpoint for Railway/other platforms
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            connections: this.clients.size
          }));
          return;
        }
        
        // Default response for other HTTP requests
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('WebSocket server - use /chat endpoint for WebSocket connections');
      });
      
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        path: '/chat'
      });

      // Handle WebSocket connections
      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });

      // Start the server
      this.server.listen(CHAT_SERVER_PORT, () => {
        console.log(`Chat server running on port ${CHAT_SERVER_PORT}`);
      });

      // Handle graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      console.error('Failed to start chat server:', error);
      process.exit(1);
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    
    console.log(`New client connected: ${clientId}`);

    // Store client connection
    this.clients.set(clientId, {
      ws,
      walletAddress: null,
      rooms: new Set(),
      lastActivity: Date.now()
    });

    // Set up message handlers
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle incoming messages from clients
   */
  async handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Update last activity
      client.lastActivity = Date.now();

      // Parse message
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        this.sendError(clientId, 'Invalid message format');
        return;
      }

      // Validate message structure
      if (!message.type) {
        this.sendError(clientId, 'Message type is required');
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'authenticate':
          await this.handleAuthentication(clientId, message);
          break;
        case 'join_room':
          await this.handleJoinRoom(clientId, message);
          break;
        case 'leave_room':
          await this.handleLeaveRoom(clientId, message);
          break;
        case 'send_message':
          await this.handleSendMessage(clientId, message);
          break;
        case 'get_messages':
          await this.handleGetMessages(clientId, message);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
      }

    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
      this.sendError(clientId, 'Internal server error');
    }
  }

  /**
   * Handle user authentication
   */
  async handleAuthentication(clientId, message) {
    const { walletAddress } = message;
    
    if (!walletAddress) {
      this.sendError(clientId, 'Wallet address is required');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    // Validate wallet address format (basic validation)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      this.sendError(clientId, 'Invalid wallet address format');
      return;
    }

    // Store wallet address
    client.walletAddress = walletAddress.toLowerCase();

    // Initialize rate limiting for this user
    this.rateLimits.set(client.walletAddress, {
      messages: [],
      lastReset: Date.now()
    });

    this.sendToClient(clientId, {
      type: 'authenticated',
      walletAddress: client.walletAddress,
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} authenticated as ${client.walletAddress}`);
  }

  /**
   * Handle joining a chat room
   */
  async handleJoinRoom(clientId, message) {
    const { roomId } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.walletAddress) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    if (!roomId) {
      this.sendError(clientId, 'Room ID is required');
      return;
    }

    try {
      // Join room in database
      const { data, error } = await supabase.rpc('join_chat_room', {
        p_room_id: roomId,
        p_user_wallet_address: client.walletAddress
      });

      if (error) {
        console.error('Database error joining room:', error);
        this.sendError(clientId, 'Failed to join room');
        return;
      }

      if (!data) {
        this.sendError(clientId, 'Room is full or does not exist');
        return;
      }

      // Add to local room tracking
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, new Set());
      }
      this.rooms.get(roomId).add(clientId);
      client.rooms.add(roomId);

      // Notify client
      this.sendToClient(clientId, {
        type: 'room_joined',
        roomId,
        timestamp: new Date().toISOString()
      });

      // Notify other room participants
      this.broadcastToRoom(roomId, {
        type: 'user_joined',
        roomId,
        walletAddress: client.walletAddress,
        timestamp: new Date().toISOString()
      }, clientId);

      console.log(`Client ${clientId} joined room ${roomId}`);

    } catch (error) {
      console.error('Error joining room:', error);
      this.sendError(clientId, 'Failed to join room');
    }
  }

  /**
   * Handle leaving a chat room
   */
  async handleLeaveRoom(clientId, message) {
    const { roomId } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.walletAddress) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    if (!roomId) {
      this.sendError(clientId, 'Room ID is required');
      return;
    }

    try {
      // Leave room in database
      await supabase.rpc('leave_chat_room', {
        p_room_id: roomId,
        p_user_wallet_address: client.walletAddress
      });

      // Remove from local room tracking
      if (this.rooms.has(roomId)) {
        this.rooms.get(roomId).delete(clientId);
        if (this.rooms.get(roomId).size === 0) {
          this.rooms.delete(roomId);
        }
      }
      client.rooms.delete(roomId);

      // Notify client
      this.sendToClient(clientId, {
        type: 'room_left',
        roomId,
        timestamp: new Date().toISOString()
      });

      // Notify other room participants
      this.broadcastToRoom(roomId, {
        type: 'user_left',
        roomId,
        walletAddress: client.walletAddress,
        timestamp: new Date().toISOString()
      }, clientId);

      console.log(`Client ${clientId} left room ${roomId}`);

    } catch (error) {
      console.error('Error leaving room:', error);
      this.sendError(clientId, 'Failed to leave room');
    }
  }

  /**
   * Handle sending a chat message
   */
  async handleSendMessage(clientId, message) {
    const { roomId, content, messageType = 'text' } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.walletAddress) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    if (!roomId || !content) {
      this.sendError(clientId, 'Room ID and message content are required');
      return;
    }

    // Validate message length
    if (content.length > MAX_MESSAGE_LENGTH) {
      this.sendError(clientId, `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(client.walletAddress)) {
      this.sendError(clientId, 'Rate limit exceeded. Please slow down.');
      return;
    }

    // Check if user is in the room
    if (!client.rooms.has(roomId)) {
      this.sendError(clientId, 'You are not in this room');
      return;
    }

    try {
      // Save message to database
      const { data: messageId, error } = await supabase.rpc('send_chat_message', {
        p_room_id: roomId,
        p_user_wallet_address: client.walletAddress,
        p_message_content: content,
        p_message_type: messageType
      });

      if (error) {
        console.error('Database error sending message:', error);
        this.sendError(clientId, 'Failed to send message');
        return;
      }

      // Get user profile for the message
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('nickname, avatar_url')
        .eq('wallet_address', client.walletAddress)
        .single();

      // Broadcast message to all room participants
      const messageData = {
        type: 'new_message',
        id: messageId,
        roomId,
        walletAddress: client.walletAddress,
        nickname: profile?.nickname || `${client.walletAddress.substring(0, 8)}...`,
        avatarUrl: profile?.avatar_url,
        content,
        messageType,
        timestamp: new Date().toISOString()
      };

      this.broadcastToRoom(roomId, messageData);

      console.log(`Message sent in room ${roomId} by ${client.walletAddress}`);

    } catch (error) {
      console.error('Error sending message:', error);
      this.sendError(clientId, 'Failed to send message');
    }
  }

  /**
   * Handle getting chat message history
   */
  async handleGetMessages(clientId, message) {
    const { roomId, limit = 50, offset = 0 } = message;
    const client = this.clients.get(clientId);
    
    if (!client || !client.walletAddress) {
      this.sendError(clientId, 'Authentication required');
      return;
    }

    if (!roomId) {
      this.sendError(clientId, 'Room ID is required');
      return;
    }

    try {
      // Get messages from database
      const { data: messages, error } = await supabase.rpc('get_chat_messages', {
        p_room_id: roomId,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Database error getting messages:', error);
        this.sendError(clientId, 'Failed to get messages');
        return;
      }

      // Send messages to client (reverse order for chronological display)
      this.sendToClient(clientId, {
        type: 'message_history',
        roomId,
        messages: messages.reverse(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error getting messages:', error);
      this.sendError(clientId, 'Failed to get messages');
    }
  }

  /**
   * Handle ping message (keep-alive)
   */
  handlePing(clientId) {
    this.sendToClient(clientId, {
      type: 'pong',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check rate limiting for a user
   */
  checkRateLimit(walletAddress) {
    const now = Date.now();
    const userLimit = this.rateLimits.get(walletAddress);
    
    if (!userLimit) return true;

    // Reset rate limit window if needed
    if (now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
      userLimit.messages = [];
      userLimit.lastReset = now;
    }

    // Check if user has exceeded rate limit
    if (userLimit.messages.length >= RATE_LIMIT_MESSAGES) {
      return false;
    }

    // Add current message to rate limit tracking
    userLimit.messages.push(now);
    return true;
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to a client
   */
  sendError(clientId, errorMessage) {
    this.sendToClient(clientId, {
      type: 'error',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to all clients in a room
   */
  broadcastToRoom(roomId, message, excludeClientId = null) {
    const roomClients = this.rooms.get(roomId);
    if (!roomClients) return;

    roomClients.forEach(clientId => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  /**
   * Handle client disconnection
   */
  async handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`Client disconnected: ${clientId}`);

    // Leave all rooms
    for (const roomId of client.rooms) {
      if (client.walletAddress) {
        try {
          await supabase.rpc('leave_chat_room', {
            p_room_id: roomId,
            p_user_wallet_address: client.walletAddress
          });

          // Notify other room participants
          this.broadcastToRoom(roomId, {
            type: 'user_left',
            roomId,
            walletAddress: client.walletAddress,
            timestamp: new Date().toISOString()
          }, clientId);
        } catch (error) {
          console.error('Error leaving room on disconnect:', error);
        }
      }

      // Remove from local room tracking
      if (this.rooms.has(roomId)) {
        this.rooms.get(roomId).delete(clientId);
        if (this.rooms.get(roomId).size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    // Clean up client data
    this.clients.delete(clientId);
    if (client.walletAddress) {
      this.rateLimits.delete(client.walletAddress);
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down chat server...');
    
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      client.ws.close();
    });

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close();
    }

    process.exit(0);
  }
}

// Start the chat server
const chatServer = new ChatServer();
chatServer.start().catch(error => {
  console.error('Failed to start chat server:', error);
  process.exit(1);
});

export default ChatServer;