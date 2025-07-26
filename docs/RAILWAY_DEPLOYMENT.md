# Railway Deployment Guide for ETH Shot Chat Server

This guide will help you deploy the WebSocket chat server to Railway.app.

## Prerequisites

- Railway account (free tier available)
- GitHub repository with the chat server code
- Domain name for custom URL (optional but recommended)

## Step 1: Railway Project Setup

### Option A: Deploy from GitHub (Recommended)

1. **Go to Railway Dashboard**: Visit [railway.app](https://railway.app) and sign in
2. **Create New Project**: Click "New Project"
3. **Deploy from GitHub repo**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose your `ethshot-web` repository
5. **Configure Service**: Railway will detect the Node.js project automatically

### Option B: Deploy from CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in your repo
railway init

# Deploy
railway up
```

## Step 2: Environment Variables

In your Railway project dashboard, go to **Variables** tab and add:

```env
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=8080
NODE_ENV=production

# CORS Configuration (your frontend domain)
ALLOWED_ORIGINS=https://ethshot.io,https://www.ethshot.io
```

## Step 3: Custom Domain Setup

1. **Go to Settings**: In your Railway project, click "Settings"
2. **Domains**: Click "Domains" tab
3. **Custom Domain**: Add `chat.ethshot.io`
4. **DNS Configuration**: Add these DNS records to your domain:

```
Type: CNAME
Name: chat
Value: your-railway-app.railway.app
```

## Step 4: Verify Deployment

### Check Health Endpoint
```bash
curl -I https://chat.ethshot.io/health
```

Expected response:
```
HTTP/2 200
content-type: application/json
```

### Test WebSocket Connection
```javascript
// Test in browser console
const ws = new WebSocket('wss://chat.ethshot.io/chat');
ws.onopen = () => console.log('Connected to chat server');
ws.onerror = (error) => console.error('Connection error:', error);
```

## Step 5: Update Frontend Configuration

Update your `.env` file:
```env
VITE_CHAT_SERVER_URL=wss://chat.ethshot.io/chat
```

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check that `package.json` has correct start script
   - Verify all dependencies are listed in `package.json`

2. **WebSocket Connection Fails**
   - Ensure CORS origins include your frontend domain
   - Check that Railway service is running on correct port

3. **Database Connection Issues**
   - Verify Supabase environment variables are correct
   - Check Supabase project is accessible from Railway

### Railway Configuration Files

The following files help Railway understand your deployment:

- `railway.json` - Railway-specific configuration
- `nixpacks.toml` - Build configuration
- `Procfile` - Process definition

### Logs and Monitoring

View logs in Railway dashboard:
1. Go to your project
2. Click on the service
3. View "Deployments" tab for build logs
4. View "Metrics" tab for runtime monitoring

## Cost Estimation

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month
  - 512MB RAM, 1 vCPU
  - $0.000463 per GB-hour
  - Perfect for chat server

- **Pro Plan**: $20/month
  - More resources and priority support

## Alternative: Railway + Custom Server

If you need more control, you can also:

1. Deploy to Railway for development/staging
2. Use a VPS (DigitalOcean, Linode) for production
3. Set up load balancing for high availability

## Next Steps

1. Deploy chat server to Railway
2. Configure custom domain
3. Update frontend environment variables
4. Test end-to-end functionality
5. Monitor performance and scale as needed

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- ETH Shot Chat Issues: Create GitHub issue in your repository