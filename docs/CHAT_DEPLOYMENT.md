# Chat System Deployment Guide

The chat system requires a persistent WebSocket server, which presents deployment challenges on serverless platforms like Vercel. Here are the recommended deployment strategies:

## 🚨 **Vercel Limitations**

Vercel's serverless functions have limitations that make WebSocket servers challenging:
- **10-second timeout** for serverless functions
- **No persistent connections** between requests
- **No long-running processes** support

## 🎯 **Recommended Deployment Options**

### **Option 1: Hybrid Deployment (Recommended)**

Deploy the main SvelteKit app on Vercel and the chat server separately:

#### **Frontend (Vercel)**
- Deploy the SvelteKit app normally to Vercel
- Configure environment variables for the external chat server

#### **Chat Server (External Service)**
Choose one of these platforms for the WebSocket server:

**A. Railway** (Easiest)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and create project
railway login
railway init

# 3. Create railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server/chat-server.js",
    "healthcheckPath": "/health"
  }
}

# 4. Deploy
railway up
```

**B. Render** (Free tier available)
```yaml
# render.yaml
services:
  - type: web
    name: ethshot-chat
    env: node
    buildCommand: pnpm install
    startCommand: node server/chat-server.js
    envVars:
      - key: VITE_SUPABASE_URL
        sync: false
      - key: VITE_SUPABASE_ANON_KEY
        sync: false
```

**C. DigitalOcean App Platform**
```yaml
# .do/app.yaml
name: ethshot-chat
services:
- name: chat-server
  source_dir: /
  github:
    repo: your-repo
    branch: main
  run_command: node server/chat-server.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: VITE_SUPABASE_URL
    value: ${VITE_SUPABASE_URL}
  - key: VITE_SUPABASE_ANON_KEY
    value: ${VITE_SUPABASE_ANON_KEY}
```

### **Option 2: Supabase Realtime (Alternative)**

Replace WebSocket server with Supabase Realtime subscriptions:

```javascript
// src/lib/utils/supabase-chat.js
import { supabase } from '$lib/supabase.js';

export class SupabaseChatClient {
  constructor() {
    this.subscriptions = new Map();
  }

  async joinRoom(roomId) {
    // Subscribe to new messages in the room
    const subscription = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        this.handleNewMessage(payload.new);
      })
      .subscribe();

    this.subscriptions.set(roomId, subscription);
  }

  async sendMessage(roomId, content) {
    const { data, error } = await supabase.rpc('send_chat_message', {
      p_room_id: roomId,
      p_user_wallet_address: this.walletAddress,
      p_message_content: content
    });

    if (error) throw error;
    return data;
  }

  handleNewMessage(message) {
    // Emit to chat store
    this.emit('new_message', message);
  }
}
```

### **Option 3: Vercel Edge Functions + External WebSocket**

Use Vercel Edge Functions as a proxy to an external WebSocket service:

```javascript
// api/chat/[...path].js
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const chatServerUrl = process.env.CHAT_SERVER_URL;
  
  // Proxy WebSocket upgrade requests
  if (request.headers.get('upgrade') === 'websocket') {
    return new Response('WebSocket proxy not supported in Edge Functions', {
      status: 426
    });
  }
  
  // Proxy HTTP requests to chat server
  const response = await fetch(`${chatServerUrl}${url.pathname}`, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return response;
}
```

## 🔧 **Configuration for Production**

### **Environment Variables**

Update your production environment variables:

```env
# Production .env
NODE_ENV=production

# Chat server URL (external service)
VITE_CHAT_SERVER_URL=wss://your-chat-server.railway.app/chat
# or
VITE_CHAT_SERVER_URL=wss://your-chat-server.render.com/chat

# Supabase (same as current)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### **Update Chat Client Configuration**

```javascript
// src/lib/config/chat.js
const getEnvVar = (name, fallback) => {
  if (browser) {
    return import.meta.env[name] || fallback;
  }
  return process.env[name] || fallback;
};

export const CHAT_CONFIG = {
  // Use environment variable for production
  SERVER_URL: getEnvVar('VITE_CHAT_SERVER_URL', 'ws://localhost:8080/chat'),
  // ... rest of config
};
```

## 🚀 **Deployment Steps**

### **Step 1: Deploy Chat Server**

Choose Railway (recommended):

```bash
# 1. Create Railway project
railway init ethshot-chat

# 2. Add environment variables in Railway dashboard
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
CHAT_SERVER_PORT=8080

# 3. Deploy
railway up

# 4. Get the deployment URL
railway status
```

### **Step 2: Update Frontend Configuration**

```bash
# Update Vercel environment variables
vercel env add VITE_CHAT_SERVER_URL
# Enter: wss://your-railway-app.railway.app/chat
```

### **Step 3: Deploy Frontend to Vercel**

```bash
# Deploy as usual
vercel --prod
```

## 📊 **Cost Comparison**

| Platform | Free Tier | Paid Plans | WebSocket Support |
|----------|-----------|------------|-------------------|
| **Railway** | $5/month credit | $0.000463/GB-hour | ✅ Full support |
| **Render** | 750 hours/month | $7/month | ✅ Full support |
| **DigitalOcean** | $200 credit | $5/month | ✅ Full support |
| **Heroku** | No free tier | $7/month | ✅ Full support |
| **Fly.io** | Generous free tier | $1.94/month | ✅ Full support |

## 🔄 **Alternative: Serverless Chat**

If you prefer a fully serverless solution, consider replacing WebSockets with:

### **Supabase Realtime + Polling**

```javascript
// Hybrid approach: Realtime for new messages, polling for presence
export class ServerlessChatClient {
  constructor() {
    this.realtimeClient = supabase.realtime;
    this.pollInterval = null;
  }

  async joinRoom(roomId) {
    // Subscribe to new messages via Supabase Realtime
    this.subscription = this.realtimeClient
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`
      }, this.handleNewMessage.bind(this))
      .subscribe();

    // Poll for user presence every 30 seconds
    this.pollInterval = setInterval(() => {
      this.updatePresence(roomId);
    }, 30000);
  }

  async sendMessage(roomId, content) {
    return await supabase.rpc('send_chat_message', {
      p_room_id: roomId,
      p_user_wallet_address: this.walletAddress,
      p_message_content: content
    });
  }
}
```

## 🎯 **Recommended Production Setup**

For **ETH Shot**, I recommend:

1. **Frontend**: Keep on Vercel (fast, reliable, great for SvelteKit)
2. **Chat Server**: Deploy to Railway (simple, affordable, WebSocket support)
3. **Database**: Keep Supabase (already configured)

This gives you:
- ✅ **Scalable** frontend on Vercel's CDN
- ✅ **Persistent** WebSocket connections on Railway
- ✅ **Reliable** database with Supabase
- ✅ **Cost-effective** (~$5-10/month total)

## 🔧 **Quick Setup Script**

```bash
#!/bin/bash
# deploy-chat.sh

echo "🚀 Deploying ETH Shot Chat System"

# 1. Deploy chat server to Railway
echo "📡 Deploying chat server..."
railway login
railway init ethshot-chat
railway up

# 2. Get Railway URL
CHAT_URL=$(railway status --json | jq -r '.deployments[0].url')
echo "Chat server deployed to: $CHAT_URL"

# 3. Update Vercel environment
echo "🔧 Updating Vercel environment..."
vercel env add VITE_CHAT_SERVER_URL "wss://${CHAT_URL}/chat"

# 4. Deploy frontend
echo "🌐 Deploying frontend..."
vercel --prod

echo "✅ Deployment complete!"
echo "Frontend: https://your-app.vercel.app"
echo "Chat Server: wss://${CHAT_URL}/chat"
```

This setup ensures your chat system works reliably in production while leveraging the best of both Vercel and dedicated WebSocket hosting! 🎮💬