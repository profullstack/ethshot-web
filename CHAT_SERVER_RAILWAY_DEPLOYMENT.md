# Chat Server Railway Deployment Guide

## Required Environment Variables

The chat server needs the following environment variables to be set in Railway:

### 1. Supabase Configuration
```bash
# Supabase URL (same as main app)
VITE_SUPABASE_URL=your_supabase_project_url
# or
PUBLIC_SUPABASE_URL=your_supabase_project_url

# Supabase Anonymous Key (same as main app)
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# or
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. JWT Authentication (Choose ONE method)

#### Option A: ES256 JWT Keys (Recommended - More Secure)
```bash
# JWT Public Key in JWK format (for token validation)
JWT_PUBLIC_KEY_JWK={"kty":"EC","crv":"P-256","x":"...","y":"..."}

# Optional: JWT Private Key (only if chat server needs to generate tokens)
JWT_PRIVATE_KEY_JWK={"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}
```

#### Option B: HS256 JWT Secret (Fallback)
```bash
# Supabase JWT Secret (same as main app)
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
# or
VITE_SUPABASE_JWT_SECRET=your_supabase_jwt_secret
```

### 3. Server Configuration
```bash
# Port (Railway will set this automatically, but you can override)
PORT=8080

# Node Environment
NODE_ENV=production
```

## How to Get the JWT Keys

### For ES256 Keys (Recommended)
If you have the JWT keys in your main application:

1. **From your main app's environment variables:**
   - Copy `JWT_PUBLIC_KEY_JWK` from your main Railway deployment
   - Copy `JWT_PRIVATE_KEY_JWK` if available (optional for chat server)

2. **From local development files:**
   - If you have `jwt.json` (public key) and `jwk-private-key.json` (private key) files
   - Copy the contents of these files as JSON strings

### For HS256 Secret (Fallback)
- Copy `SUPABASE_JWT_SECRET` from your main Railway deployment
- This is the same secret used by Supabase for JWT signing

## Railway Deployment Steps

1. **Create a new Railway service for the chat server:**
   ```bash
   # In the servers/chat directory
   railway login
   railway init
   railway up
   ```

2. **Set environment variables in Railway dashboard:**
   - Go to your Railway project
   - Select the chat server service
   - Go to "Variables" tab
   - Add all the required environment variables listed above

3. **Deploy the chat server:**
   ```bash
   # Railway will automatically deploy when you push changes
   git add .
   git commit -m "Deploy chat server with JWT authentication"
   git push
   ```

## Verification

After deployment, you can verify the chat server is working:

1. **Check the health endpoint:**
   ```bash
   curl https://your-chat-server-url.railway.app/health
   ```

2. **Check the logs in Railway dashboard:**
   - Look for messages like:
     - `🔑 Loading JWT public key from environment variables...`
     - `✅ ES256 public key loaded successfully`
     - `🚀 Chat server running on port 8080`
     - `📊 Supabase: Connected`

## Troubleshooting

### Common Issues:

1. **"No JWT validation method available"**
   - Make sure you've set either `JWT_PUBLIC_KEY_JWK` or `SUPABASE_JWT_SECRET`

2. **"Supabase configuration missing"**
   - Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly

3. **"Failed to load ES256 public key"**
   - Check that `JWT_PUBLIC_KEY_JWK` is valid JSON
   - Ensure the JWK format is correct

4. **Authentication failures**
   - Verify the JWT keys match between main app and chat server
   - Check that tokens are being generated with the same algorithm (ES256 vs HS256)

## Security Notes

- **Never expose private keys in client-side code**
- **Use ES256 keys when possible** (more secure than HS256)
- **Keep JWT secrets secure** and rotate them periodically
- **Use environment variables** for all sensitive configuration

## Testing the Deployment

You can test the chat authentication using the test file:

```bash
# Update the WebSocket URL in the test to point to your Railway deployment
# Then run the test
pnpm exec mocha tests/chat-jwt-authentication.test.js --timeout 10000
```

Make sure to update the WebSocket URL in the test from `ws://localhost:8080/chat` to your Railway deployment URL.