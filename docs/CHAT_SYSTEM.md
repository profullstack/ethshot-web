# Real-time Chat System

A comprehensive real-time chat system for the ETH Shot game, allowing players to trash talk and communicate during gameplay using native WebSockets.

## Features

- **Real-time messaging** using native WebSocket connections
- **Multiple chat rooms** (Global Chat, Trash Talk, Game Discussion)
- **User authentication** integrated with wallet system
- **Message persistence** with Supabase database
- **Rate limiting** and spam protection
- **Basic moderation** with profanity filtering
- **Responsive UI** with mobile support
- **Unread message notifications**
- **Sound notifications**
- **Message history** with pagination

## Architecture

### Components

1. **WebSocket Server** (`server/chat-server.js`)
   - Native Node.js WebSocket server
   - Handles real-time connections
   - Manages room subscriptions
   - Implements rate limiting

2. **Chat Client** (`src/lib/utils/chat-client.js`)
   - Browser WebSocket client
   - Automatic reconnection
   - Message queuing
   - Event-driven architecture

3. **Chat Store** (`src/lib/stores/chat.js`)
   - Svelte store for state management
   - Reactive UI updates
   - Message caching
   - User preferences

4. **Chat Widget** (`src/lib/components/ChatWidget.svelte`)
   - Complete chat UI component
   - Room switching
   - Message input with validation
   - Responsive design

5. **Database Schema** (`supabase/migrations/20250726021500_chat_system.sql`)
   - Chat rooms and messages
   - User participation tracking
   - Settings and preferences

## Installation & Setup

### 1. Install Dependencies

```bash
pnpm add ws
```

### 2. Database Migration

Run the chat system migration:

```bash
pnpm run db:migrate
```

### 3. Environment Variables

Add to your `.env` file:

```env
# Chat server configuration
CHAT_SERVER_PORT=8080
CHAT_ENABLED=true

# Supabase configuration (already configured)
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Start the Chat Server

In development:
```bash
pnpm run chat:dev
```

In production:
```bash
pnpm run chat:start
```

### 5. Start the Web Application

```bash
pnpm run dev
```

## Usage

### Basic Usage

1. **Connect Wallet**: Users must connect their wallet to authenticate
2. **Open Chat**: Click the chat button in the bottom-right corner
3. **Join Rooms**: Select from available chat rooms
4. **Send Messages**: Type and press Enter to send messages
5. **View History**: Scroll up to load previous messages

### Chat Rooms

- **Global Chat**: General discussion for all players (auto-join)
- **Trash Talk**: Dedicated room for competitive banter
- **Game Discussion**: Strategy and tips discussion

### Moderation Features

- **Profanity Filter**: Automatically filters inappropriate content
- **Spam Detection**: Prevents duplicate and excessive messages
- **Rate Limiting**: 10 messages per minute per user
- **Message Length**: Maximum 500 characters per message

## API Reference

### WebSocket Messages

#### Client to Server

```javascript
// Authenticate with wallet
{
  type: 'authenticate',
  walletAddress: '0x...'
}

// Join a room
{
  type: 'join_room',
  roomId: 'global'
}

// Send message
{
  type: 'send_message',
  roomId: 'global',
  content: 'Hello world!',
  messageType: 'text'
}

// Get message history
{
  type: 'get_messages',
  roomId: 'global',
  limit: 50,
  offset: 0
}
```

#### Server to Client

```javascript
// New message received
{
  type: 'new_message',
  id: 'uuid',
  roomId: 'global',
  walletAddress: '0x...',
  nickname: 'Player1',
  content: 'Hello world!',
  timestamp: '2025-01-26T02:25:00Z'
}

// User joined room
{
  type: 'user_joined',
  roomId: 'global',
  walletAddress: '0x...',
  timestamp: '2025-01-26T02:25:00Z'
}

// Error message
{
  type: 'error',
  message: 'Rate limit exceeded',
  timestamp: '2025-01-26T02:25:00Z'
}
```

### Database Functions

#### Send Message
```sql
SELECT send_chat_message(
  'room-uuid',
  '0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6',
  'Hello world!',
  'text'
);
```

#### Get Messages
```sql
SELECT * FROM get_chat_messages(
  'room-uuid',
  50,  -- limit
  0    -- offset
);
```

#### Join Room
```sql
SELECT join_chat_room(
  'room-uuid',
  '0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6'
);
```

## Configuration

### Chat Configuration (`src/lib/config/chat.js`)

```javascript
export const CHAT_CONFIG = {
  SERVER_URL: 'ws://localhost:8080/chat',
  MAX_MESSAGE_LENGTH: 500,
  RATE_LIMIT_MESSAGES: 10,
  RATE_LIMIT_WINDOW: 60 * 1000,
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  // ... more options
};
```

### Feature Flags

```javascript
FEATURES: {
  CHAT_ENABLED: true,
  VOICE_CHAT_ENABLED: false,
  FILE_SHARING_ENABLED: false,
  EMOJI_REACTIONS_ENABLED: true,
  PRIVATE_MESSAGES_ENABLED: false
}
```

## Testing

Run the chat system tests:

```bash
# Run all tests
pnpm test

# Run only chat tests
pnpm test tests/chat-system.test.js

# Run with coverage
pnpm test:coverage
```

### Test Coverage

- WebSocket client functionality
- Message validation
- Rate limiting logic
- Room management
- Error handling
- Store state management

## Security Considerations

### Authentication
- Users must connect wallet to authenticate
- Wallet address validation on server
- Session management with client IDs

### Rate Limiting
- 10 messages per minute per user
- Duplicate message detection
- Spam prevention algorithms

### Input Validation
- Message length limits (500 characters)
- Profanity filtering
- XSS prevention (content sanitization)

### Database Security
- Row Level Security (RLS) policies
- Parameterized queries
- User isolation

## Performance Optimizations

### Client-side
- Message pagination (50 messages per load)
- Automatic reconnection with exponential backoff
- Local message caching
- Efficient DOM updates with Svelte

### Server-side
- Connection pooling
- Memory-efficient message broadcasting
- Graceful connection cleanup
- Rate limiting with in-memory tracking

### Database
- Indexed queries for fast message retrieval
- Efficient pagination with LIMIT/OFFSET
- Optimized user lookup with wallet address index

## Deployment

### Development
```bash
# Terminal 1: Start web app
pnpm run dev

# Terminal 2: Start chat server
pnpm run chat:dev
```

### Production

1. **Build the application**:
```bash
pnpm run build
```

2. **Start services**:
```bash
# Start chat server
pnpm run chat:start

# Start web server (varies by deployment platform)
node build/index.js
```

3. **Environment variables**:
```env
NODE_ENV=production
CHAT_SERVER_PORT=8080
CHAT_ENABLED=true
```

### Docker Deployment

```dockerfile
# Add to your Dockerfile
EXPOSE 8080
CMD ["node", "server/chat-server.js"]
```

## Monitoring & Logging

### Server Logs
- Connection events
- Message statistics
- Error tracking
- Performance metrics

### Client Logs
- Connection status
- Message delivery
- Error reporting
- User interactions

## Troubleshooting

### Common Issues

1. **Chat not connecting**
   - Check if chat server is running on port 8080
   - Verify WebSocket URL in configuration
   - Check browser console for errors

2. **Messages not sending**
   - Ensure wallet is connected and authenticated
   - Check rate limiting (10 messages/minute)
   - Verify user is in the target room

3. **Database errors**
   - Run migrations: `pnpm run db:migrate`
   - Check Supabase connection
   - Verify RLS policies

### Debug Mode

Enable debug logging:
```javascript
// In chat-client.js
const DEBUG = true;
```

## Future Enhancements

### Planned Features
- [ ] Private messaging
- [ ] Voice chat integration
- [ ] File sharing
- [ ] Emoji reactions
- [ ] Message threading
- [ ] Advanced moderation tools
- [ ] Chat analytics
- [ ] Mobile app support

### Performance Improvements
- [ ] Redis for message caching
- [ ] WebSocket clustering
- [ ] CDN for static assets
- [ ] Database connection pooling

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Test with multiple users
5. Consider mobile responsiveness

## License

This chat system is part of the ETH Shot project and follows the same license terms.