# ETH Shot - Production Deployment Guide

This guide explains how to deploy ETH Shot to production and configure the required environment variables.

## Environment Variables Required for Production

The application uses `VITE_` prefixed environment variables that must be set in your production environment (e.g., Vercel, Netlify, etc.).

### Required Environment Variables

#### Smart Contract Configuration
```bash
VITE_CONTRACT_ADDRESS=0xa6F8E4091D9D56A61101B1B2604451B85Eb69Dc7
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111
VITE_BLOCK_EXPLORER_URL=https://sepolia.etherscan.io
```

#### Supabase Database Configuration
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Game Configuration (must match deployed contract)
```bash
VITE_SHOT_COST_ETH=0.0005
VITE_SPONSOR_COST_ETH=0.001
VITE_WIN_PERCENTAGE=1
VITE_WINNER_PAYOUT_PERCENTAGE=90
VITE_HOUSE_FEE_PERCENTAGE=10
VITE_COOLDOWN_HOURS=1
```

#### Application Configuration
```bash
VITE_APP_URL=https://your-domain.com
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

## Deployment Steps

### 1. Vercel Deployment

1. **Connect your repository to Vercel**
2. **Set environment variables in Vercel dashboard:**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add all the required `VITE_` prefixed variables listed above

3. **Deploy:**
   ```bash
   # Vercel will automatically deploy when you push to main branch
   git push origin main
   ```

### 2. Netlify Deployment

1. **Connect your repository to Netlify**
2. **Set environment variables in Netlify dashboard:**
   - Go to Site settings > Environment variables
   - Add all the required `VITE_` prefixed variables

3. **Build settings:**
   ```bash
   Build command: pnpm build
   Publish directory: build
   ```

### 3. Manual Deployment

1. **Set environment variables in your hosting environment**
2. **Build the application:**
   ```bash
   pnpm install
   pnpm build
   ```
3. **Deploy the `build` directory to your web server**

## Environment Variable Sources

The application uses a centralized configuration system in `src/lib/config.js` that supports both `VITE_` and `PUBLIC_` prefixed variables as fallbacks:

```javascript
// Example from config.js
CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS || import.meta.env.PUBLIC_CONTRACT_ADDRESS || ''
```

This ensures compatibility with different deployment platforms and development setups.

## Troubleshooting

### "Smart contract not deployed yet" Error

This error occurs when `VITE_CONTRACT_ADDRESS` is not set in production. Make sure:

1. ✅ `VITE_CONTRACT_ADDRESS` is set in your production environment
2. ✅ The contract address is correct (from `deployment.json`)
3. ✅ The RPC URL is accessible and valid
4. ✅ All environment variables are properly prefixed with `VITE_`

### Supabase Configuration Errors

If you see "Supabase configuration missing" errors:

1. ✅ Set `VITE_SUPABASE_URL` in production
2. ✅ Set `VITE_SUPABASE_ANON_KEY` in production
3. ✅ Verify the Supabase project is accessible

### Contract Connection Issues

If the contract fails to connect:

1. ✅ Verify the contract address is deployed on the correct network
2. ✅ Check that the RPC URL is working
3. ✅ Ensure the chain ID matches the network (11155111 for Sepolia)

## Security Notes

- Never commit `.env` files to version control
- Use your hosting platform's environment variable management
- Rotate API keys regularly
- Monitor your Infura/Alchemy usage

## Contract Information

- **Network:** Sepolia Testnet
- **Contract Address:** `0xa6F8E4091D9D56A61101B1B2604451B85Eb69Dc7`
- **Etherscan:** https://sepolia.etherscan.io/address/0xa6F8E4091D9D56A61101B1B2604451B85Eb69Dc7
- **Deployment Date:** 2025-07-23T14:06:37.815Z

## Support

If you encounter issues during deployment:

1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Test the contract connection using a blockchain explorer
4. Ensure your RPC provider (Infura/Alchemy) is working

For development setup, see `README.md`.