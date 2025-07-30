/**
 * WebSocket Chat Server
 * Handles real-time chat functionality with native WebSocket support
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createPublicKey } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.VITE_SUPABASE_JWT_SECRET;

// Load JWT keys for token validation
let publicKey = null;
let jwtSecret = null;

// Try to load ES256 public key first, then fallback to HS256 secret
try {
  let publicKeyData;
  
  // Try to load from environment variables first (production)
  if (process.env.JWT_PUBLIC_KEY_JWK) {
    console.log('🔑 Loading JWT public key from environment variables...');
    publicKeyData = JSON.parse(process.env.JWT_PUBLIC_KEY_JWK);
    publicKey = createPublicKey({ key: publicKeyData, format: 'jwk' });
    console.log('✅ ES256 public key loaded successfully');
  } else {
    // Fallback to file loading for development
    console.log('🔑 Attempting to load JWT public key from file (development mode)...');
    try {
      const publicKeyPath = join(__dirname, '../../jwt.json');
      publicKeyData = JSON.parse(readFileSync(publicKeyPath, 'utf8'));
      publicKey = createPublicKey({ key: publicKeyData, format: 'jwk' });
      console.log('✅ ES256 public key loaded from file successfully');
    } catch (fileError) {
      console.warn('⚠️ Could not load ES256 public key from file:', fileError.message);
    }
  }
} catch (error) {
  console.warn('⚠️ Failed to load ES256 public key:', error.message);
}

// Fallback to HS256 secret if ES256 key is not available
if (!publicKey && SUPABASE_JWT_SECRET) {
  console.log('🔑 Using HS256 JWT secret for token validation');
  jwtSecret = SUPABASE_JWT_SECRET;
} else if (!publicKey && !SUPABASE_JWT_SECRET) {
  console.error('❌ No JWT validation method available - missing both ES256 keys and HS256 secret');
  console.error('❌ Chat server authentication will not work properly');
}

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  // Initialize Supabase client
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized');
} else {
  console.warn('Supabase configuration missing - running in limited mode');
}

/**
 * Validate JWT token and extract wallet address
 * @param {string} token - The JWT token to validate
 * @returns {Promise<{valid: boolean, walletAddress?: string, error?: string}>}
 */
async function validateJWTToken(token) {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  try {
    let decoded;

    // Try ES256 verification first
    if (publicKey) {
      try {
        decoded = jwt.verify(token, publicKey, {
          algorithms: ['ES256'],
          audience: 'authenticated'
        });
      } catch (es256Error) {
        console.warn('⚠️ ES256 verification failed, trying HS256 fallback:', es256Error.message);
        
        // Fallback to HS256 if available
        if (jwtSecret) {
          decoded = jwt.verify(token, jwtSecret, {
            algorithms: ['HS256'],
            audience: 'authenticated'
          });
        } else {
          throw es256Error;
        }
      }
    } else if (jwtSecret) {
      // Use HS256 verification
      decoded = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
        audience: 'authenticated'
      });
    } else {
      return { valid: false, error: 'No JWT validation method available' };
    }

    // Extract wallet address from token
    const walletAddress = decoded.walletAddress || decoded.wallet_address || decoded.sub;
    
    if (!walletAddress) {
      return { valid: false, error: 'No wallet address found in token' };
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return { valid: false, error: 'Invalid wallet address format in token' };
    }

    return {
      valid: true,
      walletAddress: walletAddress.toLowerCase(),
      tokenData: decoded
    };

  } catch (error) {
    console.error('❌ JWT validation failed:', error.message);
    return { valid: false, error: `Invalid token: ${error.message}` };
  }
}

/**
 * Comprehensive XSS sanitization function
 * Removes potentially dangerous content while preserving safe text
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string safe for display
 */
function sanitizeMessage(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove all HTML tags and entities
  let sanitized = input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove HTML entities
    .replace(/&[#\w]+;/g, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs
    .replace(/data:/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript:/gi, '')
    // Remove on* event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove style attributes
    .replace(/style\s*=/gi, '')
    // Remove expression() CSS
    .replace(/expression\s*\(/gi, '')
    // Remove @import CSS
    .replace(/@import/gi, '')
    // Remove script tags content
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    // Remove style tags content
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    // Remove iframe tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    // Remove object tags
    .replace(/<object[^>]*>.*?<\/object>/gis, '')
    // Remove embed tags
    .replace(/<embed[^>]*>/gi, '')
    // Remove form tags
    .replace(/<form[^>]*>.*?<\/form>/gis, '')
    // Remove input tags
    .replace(/<input[^>]*>/gi, '')
    // Remove meta tags
    .replace(/<meta[^>]*>/gi, '')
    // Remove link tags
    .replace(/<link[^>]*>/gi, '')
    // Remove base tags
    .replace(/<base[^>]*>/gi, '');

  // Additional security: Remove any remaining < or > characters
  sanitized = sanitized.replace(/[<>]/g, '');

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Limit length as additional protection
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
  }

  return sanitized;
}

/**
 * Validate message content for additional security checks
 * @param {string} content - The message content to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
function validateMessageContent(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }

  // Check for suspicious patterns that might indicate XSS attempts
  const suspiciousPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /data:/i,
    /on\w+\s*=/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /<input/i,
    /expression\s*\(/i,
    /@import/i,
    /document\./i,
    /window\./i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    /Function\s*\(/i,
    /alert\s*\(/i,
    /confirm\s*\(/i,
    /prompt\s*\(/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      return {
        valid: false,
        error: 'Message contains potentially dangerous content and has been blocked for security reasons'
      };
    }
  }

  return { valid: true };
}

// Chat server configuration
const CHAT_SERVER_PORT = process.env.PORT || process.env.CHAT_SERVER_PORT || 8080;
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
        console.log(`🚀 Chat server running on port ${CHAT_SERVER_PORT}`);
        console.log(`📊 Supabase: ${supabase ? 'Connected' : 'Not available (limited mode)'}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⚡ Server ready for WebSocket connections at /chat`);
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
   * Handle user authentication with JWT token
   */
  async handleAuthentication(clientId, message) {
    const { jwtToken } = message;
    
    if (!jwtToken) {
      this.sendError(clientId, 'JWT token is required for authentication');
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Validate JWT token and extract wallet address
      const validation = await validateJWTToken(jwtToken);
      
      if (!validation.valid) {
        this.sendError(clientId, `Authentication failed: ${validation.error}`);
        return;
      }

      // Store wallet address and token data
      client.walletAddress = validation.walletAddress;
      client.jwtToken = jwtToken;
      client.tokenData = validation.tokenData;

      // Initialize rate limiting for this user
      this.rateLimits.set(client.walletAddress, {
        messages: [],
        lastReset: Date.now()
      });

      this.sendToClient(clientId, {
        type: 'authenticated',
        walletAddress: client.walletAddress,
        authMethod: 'jwt',
        timestamp: new Date().toISOString()
      });

      console.log(`Client ${clientId} authenticated via JWT as ${client.walletAddress}`);

    } catch (error) {
      console.error('JWT authentication error:', error);
      this.sendError(clientId, 'Authentication failed - invalid token');
    }
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
      // Join room in database (if available)
      if (supabase) {
        // Create authenticated Supabase client with user's JWT
        const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${client.jwtToken}`
            }
          }
        });

        const { data, error } = await authenticatedSupabase.rpc('join_chat_room_secure', {
          p_room_id: roomId
        });

        if (error) {
          console.error('Database error joining room:', error);
          this.sendError(clientId, `Failed to join room: ${error.message}`);
          return;
        }

        if (!data) {
          this.sendError(clientId, 'Room is full or does not exist');
          return;
        }
      } else {
        // If no Supabase connection, reject room joining
        this.sendError(clientId, 'Chat service unavailable - database connection required');
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
      // Leave room in database (if available)
      if (supabase) {
        // Create authenticated Supabase client with user's JWT
        const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${client.jwtToken}`
            }
          }
        });

        await authenticatedSupabase.rpc('leave_chat_room_secure', {
          p_room_id: roomId
        });
      } else {
        // If no Supabase connection, reject room operations
        this.sendError(clientId, 'Chat service unavailable - database connection required');
        return;
      }

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

    // Validate message content - reject HTML tags to prevent XSS attacks
    if (content.includes('<') || content.includes('>')) {
      this.sendError(clientId, 'Messages cannot contain HTML tags (< or >) for security reasons');
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
      let messageId = Date.now(); // Fallback ID
      let profile = null;

      // Save message to database (if available)
      if (supabase) {
        // Create authenticated Supabase client with user's JWT
        const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${client.jwtToken}`
            }
          }
        });

        const { data: dbMessageId, error } = await authenticatedSupabase.rpc('send_chat_message_secure', {
          p_room_id: roomId,
          p_message_content: content,
          p_message_type: messageType
        });

        if (error) {
          console.error('Database error sending message:', error);
          this.sendError(clientId, 'Failed to send message');
          return;
        }

        messageId = dbMessageId;

        // Get user profile for the message
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('nickname, avatar_url')
          .eq('wallet_address', client.walletAddress)
          .single();
        
        profile = profileData;
      } else {
        // If no Supabase connection, reject message sending
        this.sendError(clientId, 'Chat service unavailable - database connection required');
        return;
      }

      // Broadcast message to all room participants
      const messageData = {
        type: 'new_message',
        id: messageId,
        roomId,
        walletAddress: client.walletAddress,
        nickname: profile?.nickname || `${client.walletAddress.substring(0, 8)}...`,
        avatar_url: profile?.avatar_url,
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
      let messages = [];

      // Get messages from database (if available)
      if (supabase) {
        const { data: dbMessages, error } = await supabase.rpc('get_chat_messages', {
          p_room_id: roomId,
          p_limit: limit,
          p_offset: offset
        });

        if (error) {
          console.error('Database error getting messages:', error);
          this.sendError(clientId, 'Failed to get messages');
          return;
        }

        messages = dbMessages || [];
      } else {
        // If no Supabase connection, reject message history requests
        this.sendError(clientId, 'Chat service unavailable - database connection required');
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
          // Leave room in database (if available)
          if (supabase && client.jwtToken) {
            // Create authenticated Supabase client with user's JWT
            const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              global: {
                headers: {
                  Authorization: `Bearer ${client.jwtToken}`
                }
              }
            });

            await authenticatedSupabase.rpc('leave_chat_room_secure', {
              p_room_id: roomId
            });
          }

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