# WalletConnect Setup Guide

## Getting a WalletConnect Project ID

To enable mobile wallet support via WalletConnect, you need to get a free Project ID from WalletConnect Cloud.

### Steps:

1. **Visit WalletConnect Cloud**: Go to https://cloud.walletconnect.com/
2. **Sign Up/Login**: Create an account or login if you already have one
3. **Create New Project**: Click "Create" or "New Project"
4. **Fill Project Details**:
   - **Project Name**: ETH Shot
   - **Project Description**: A viral, pay-to-play, Ethereum-powered game
   - **Project URL**: https://ethshot.io (or your domain)
   - **Project Icon**: Upload your app icon (optional)
5. **Get Project ID**: Copy the Project ID from the dashboard

### Configuration:

1. **Add to Environment Variables**: Add your Project ID to your `.env` file:
   ```bash
   VITE_WALLETCONNECT_PROJECT_ID=your-actual-project-id-here
   ```

2. **Or for Production**: Set the environment variable in your deployment platform:
   ```bash
   VITE_WALLETCONNECT_PROJECT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

3. **Configuration is Automatic**: The app will automatically use the Project ID from `WALLET_CONFIG.WALLETCONNECT_PROJECT_ID` in `src/lib/config.js`

### Example .env file:
```bash
# WalletConnect Configuration
VITE_WALLETCONNECT_PROJECT_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
VITE_WALLETCONNECT_THEME=dark

# Other configuration...
VITE_CONTRACT_ADDRESS=0x1234...
VITE_RPC_URL=https://sepolia.infura.io/v3/your-key
```

## Testing Mobile Wallet Connection

### On Desktop:
- The "Connect Wallet" button will try browser wallets first (MetaMask, etc.)
- If no browser wallet is found, it will show WalletConnect QR code

### On Mobile:
- The "Mobile Wallet" button will directly open WalletConnect
- Users can choose from supported mobile wallets (MetaMask Mobile, Trust Wallet, etc.)

## Supported Mobile Wallets

WalletConnect supports 300+ wallets including:
- MetaMask Mobile
- Trust Wallet
- Rainbow Wallet
- Coinbase Wallet
- Phantom (mobile)
- And many more...

## Troubleshooting

### Common Issues:
1. **"Invalid Project ID"**: Make sure you copied the full Project ID correctly
2. **"Connection Failed"**: Check that your domain is added to the allowed origins in WalletConnect Cloud
3. **"No Wallets Found"**: User needs to have a WalletConnect-compatible wallet installed

### Testing:
1. Test on desktop with browser wallet first
2. Test on mobile by clicking "Mobile Wallet" button
3. Try different mobile wallets to ensure compatibility