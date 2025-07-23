# Phantom Wallet Setup for ETH Shot Deployment

## Quick Reference: Phantom Wallet Configuration

### ✅ What Phantom Does Automatically
- **Built-in RPC endpoints**: Phantom uses its own reliable RPC endpoints for standard networks
- **Network switching**: Simply select "Sepolia" from the network dropdown
- **Gas estimation**: Phantom handles gas calculations automatically
- **Transaction signing**: Phantom manages the signing process securely

### 🔧 What You Need to Configure

#### 1. Enable Sepolia Network in Phantom
1. Open Phantom wallet in Firefox
2. Click the network dropdown (shows current network like "Ethereum")
3. Look for "Sepolia" in the network list
4. If Sepolia is not visible:
   - Go to Settings → Developer Settings
   - Enable "Show test networks" or "Testnet mode"
   - Return to network dropdown and select "Sepolia"

#### 2. Get Sepolia Test ETH
- Visit: https://sepoliafaucet.com/
- Enter your Phantom wallet address
- Request test ETH (you need ~0.01 ETH for deployment)
- Wait for confirmation in your wallet

#### 3. Export Private Key (For Deployment Script)
1. In Phantom: Settings → Security & Privacy
2. Click "Show Secret Recovery Phrase" or "Export Private Key"
3. Enter your password
4. Copy the private key (starts with `0x`)
5. ⚠️ **NEVER share this key or commit it to version control!**

### 🚫 What You DON'T Need to Do
- ❌ Add custom RPC URLs (Phantom handles this)
- ❌ Configure chain ID manually (built-in)
- ❌ Set up block explorer URLs (built-in)
- ❌ Add network manually (Sepolia is pre-configured)

### 🔄 Deployment Process

#### Step 1: Configure Environment
```bash
# Edit your .env file
PRIVATE_KEY=0x_your_private_key_from_phantom
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
```

#### Step 2: Deploy Contract
```bash
# Run the deployment
pnpm run deploy:phantom
```

#### Step 3: Verify Deployment
```bash
# Verify on Etherscan
pnpm run verify:testnet CONTRACT_ADDRESS
```

### 🔍 Why You Still Need Infura/Alchemy

Even though Phantom has built-in RPC endpoints, you need your own RPC URL for:
- **Deployment scripts**: Hardhat needs a direct RPC connection
- **Frontend configuration**: Your dApp needs its own RPC endpoint
- **Rate limiting**: Avoid hitting Phantom's rate limits
- **Reliability**: Have backup RPC endpoints

### 📋 Environment Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `PRIVATE_KEY` | Deploy contracts from your wallet | `0xabc123...` |
| `SEPOLIA_RPC_URL` | Hardhat deployment connection | `https://sepolia.infura.io/v3/...` |
| `VITE_RPC_URL` | Frontend blockchain connection | `https://sepolia.infura.io/v3/...` |
| `VITE_CONTRACT_ADDRESS` | Deployed contract address | `0x123abc...` |
| `ETHERSCAN_API_KEY` | Contract verification | `ABC123...` |

### 🚨 Security Reminders

1. **Private Key Security**:
   - Never share your private key
   - Don't commit `.env` to git
   - Use different wallets for testing vs production

2. **Testnet First**:
   - Always test on Sepolia before mainnet
   - Verify all functionality works correctly
   - Check gas costs and contract behavior

3. **Backup Everything**:
   - Save your seed phrase securely
   - Record contract addresses
   - Keep deployment transaction hashes

### 🆘 Troubleshooting

#### "Network not found" error
- Enable testnet mode in Phantom settings
- Refresh the browser and try again

#### "Insufficient funds" error
- Get more Sepolia ETH from faucets
- Check you're on the correct network

#### "Invalid private key" error
- Ensure key starts with `0x`
- Check for extra spaces or characters
- Re-export from Phantom if needed

#### "RPC connection failed" error
- Verify your Infura project ID
- Check RPC URL format
- Try a different RPC provider (Alchemy)

---

**Need more help?** Check the full [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) or run `pnpm run setup:deployment` for interactive assistance.