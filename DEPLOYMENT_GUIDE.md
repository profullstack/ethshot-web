# ETH Shot Smart Contract Deployment Guide

## Overview
This guide will walk you through deploying the ETH Shot smart contract to Sepolia testnet using your Phantom wallet and pnpm commands.

## Prerequisites
- Firefox with Phantom wallet extension installed
- Node.js 20+ installed
- pnpm package manager
- Some Sepolia ETH for gas fees

## Step 1: Set up Phantom Wallet for Sepolia Testnet

### 1.1 Configure Phantom for Sepolia
1. Open Phantom wallet in Firefox
2. Click the network dropdown (usually shows "Ethereum")
3. Look for "Sepolia" in the list of available networks
4. If Sepolia is not visible, click "Show test networks" or enable developer mode in settings
5. Select "Sepolia" from the network list

**Note**: Phantom uses its own built-in RPC endpoints for standard networks like Sepolia. You don't need to (and can't) add custom RPC URLs for these networks.

### 1.2 Get Sepolia Test ETH
1. Visit a Sepolia faucet:
   - [Sepolia Faucet](https://sepoliafaucet.com/)
   - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
2. Enter your wallet address and request test ETH
3. Wait for the transaction to confirm

## Step 2: Set up RPC Provider (Infura/Alchemy)

### 2.1 Create Infura Account (Recommended)
1. Go to [Infura.io](https://infura.io)
2. Sign up for a free account
3. Create a new project
4. Copy your Project ID
5. Your Sepolia RPC URL will be: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

### 2.2 Alternative: Alchemy
1. Go to [Alchemy.com](https://alchemy.com)
2. Sign up and create a new app
3. Select "Ethereum" and "Sepolia" network
4. Copy the HTTP URL

## Step 3: Export Private Key from Phantom

⚠️ **SECURITY WARNING**: Never share your private key or commit it to version control!

1. Open Phantom wallet
2. Click the menu (three lines) → Settings
3. Click "Show Secret Recovery Phrase" or "Export Private Key"
4. Enter your password
5. Copy the private key (starts with `0x`)

## Step 4: Configure Environment Variables

### 4.1 Create .env file
```bash
# Copy the example file
cp .env.example .env
```

### 4.2 Update .env with your values
```bash
# Edit the .env file with your actual values
nano .env
```

Add these essential variables:
```env
# Deployment Configuration (for Hardhat scripts)
PRIVATE_KEY=your_private_key_from_phantom
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id
MAINNET_RPC_URL=https://mainnet.infura.io/v3/your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key_for_verification

# Game Configuration (used for both contract deployment and frontend)
VITE_CONTRACT_ADDRESS=will_be_filled_after_deployment
VITE_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_project_id
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111
```

**Note**: You need both prefixed (`VITE_`) and non-prefixed versions:
- **Non-prefixed** variables are used by Hardhat deployment scripts
- **VITE_** prefixed variables are used by the frontend (Vite/SvelteKit)

### 4.3 Contract Configuration Parameters

The ETH Shot contract is now fully configurable via environment variables. These same variables are used for both contract deployment and frontend display:

| Parameter | Environment Variable | Default | Description |
|-----------|---------------------|---------|-------------|
| Shot Cost | `VITE_SHOT_COST_ETH` | `0.001` | Cost per shot in ETH |
| Sponsor Cost | `VITE_SPONSOR_COST_ETH` | `0.05` | Cost to sponsor the pot in ETH |
| Win Chance | `VITE_WIN_PERCENTAGE` | `1` | Percentage chance to win (1-100) |
| Winner Payout | `VITE_WINNER_PAYOUT_PERCENTAGE` | `90` | Percentage of pot paid to winner |
| House Fee | `VITE_HOUSE_FEE_PERCENTAGE` | `10` | Percentage kept as house fee |
| Cooldown Period | `VITE_COOLDOWN_HOURS` | `1` | Hours between shots per address |

**Important Notes:**
- `VITE_WINNER_PAYOUT_PERCENTAGE` + `VITE_HOUSE_FEE_PERCENTAGE` must equal 100
- `VITE_WIN_PERCENTAGE` must be between 1 and 100
- These values become immutable once the contract is deployed
- The same variables are used for both deployment and frontend display (no duplication!)
- If not specified, sensible defaults are used

**Example Configuration:**
```env
# High-stakes configuration
VITE_SHOT_COST_ETH=0.01
VITE_SPONSOR_COST_ETH=0.1
VITE_WIN_PERCENTAGE=2
VITE_WINNER_PAYOUT_PERCENTAGE=95
VITE_HOUSE_FEE_PERCENTAGE=5
VITE_COOLDOWN_HOURS=24

# Low-stakes configuration
VITE_SHOT_COST_ETH=0.0001
VITE_SPONSOR_COST_ETH=0.001
VITE_WIN_PERCENTAGE=10
VITE_WINNER_PAYOUT_PERCENTAGE=80
VITE_HOUSE_FEE_PERCENTAGE=20
VITE_COOLDOWN_HOURS=0.5
```

## Step 5: Install Dependencies and Compile

### 5.1 Install all dependencies
```bash
pnpm install
```

### 5.2 Compile the smart contract
```bash
pnpm run compile
```

This will:
- Compile the Solidity contract
- Generate ABI and bytecode
- Create artifacts in the `artifacts/` directory

## Step 6: Deploy to Sepolia Testnet

### 6.1 Deploy using the advanced script (Recommended)
```bash
pnpm run deploy:testnet-advanced
```

This command runs [`scripts/deploy-testnet.js`](scripts/deploy-testnet.js) which will:
- Deploy the contract to Sepolia
- Verify contract configuration
- Save deployment info to `deployment.json`
- Create `.env.production` file
- Test basic contract functionality

### 6.2 Alternative: Basic deployment
```bash
pnpm run deploy:testnet
```

This runs the basic deployment script.

### 6.3 Expected Output
```
🚀 Deploying ETH Shot to Sepolia testnet...

📝 Deploying contract...
✅ EthShot deployed to: 0x1234567890123456789012345678901234567890
🔗 View on Etherscan: https://sepolia.etherscan.io/address/0x1234567890123456789012345678901234567890

🔍 Verifying contract configuration...
💰 Shot cost: 0.001 ETH
🎯 Sponsor cost: 0.05 ETH
⏰ Cooldown period: 3600 seconds (1 hours)

📄 Deployment info saved to: deployment.json
🔧 Environment file created: .env.production
```

## Step 7: Verify Contract on Etherscan

### 7.1 Get Etherscan API Key
1. Go to [Etherscan.io](https://etherscan.io)
2. Create account and get API key
3. Add it to your `.env` file

### 7.2 Verify the contract
The new configurable contract requires all constructor parameters for verification. The deployment script will show you the exact verification command, but you can also run it manually:

```bash
pnpm hardhat verify --network sepolia CONTRACT_ADDRESS \
  DEPLOYER_ADDRESS \
  SHOT_COST_WEI \
  SPONSOR_COST_WEI \
  COOLDOWN_SECONDS \
  WINNER_PAYOUT_PERCENT \
  HOUSE_FEE_PERCENT \
  WIN_CHANCE_PERCENT
```

**Example with default values:**
```bash
pnpm hardhat verify --network sepolia 0xf86CE38cf2120b9F2b261ef2E7a9f17f8fa5DfDd \
  0x6eE8FbD7b699D3dA2942562Ffa526920CE784D8A \
  1000000000000000 \
  50000000000000000 \
  3600 \
  90 \
  10 \
  1
```

**Note**: The deployment script automatically shows the correct verification command with all parameters after deployment. Copy and paste that command for easiest verification.

## Step 8: Update Frontend Configuration

### 8.1 Update .env with contract address
After deployment, update your `.env` file:
```env
VITE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

### 8.2 Test the frontend
```bash
pnpm run dev
```

Visit `http://localhost:5173` and test:
- Wallet connection
- Contract interaction
- Game functionality

## Step 9: Test Contract Functionality

### 9.1 Run contract tests
```bash
pnpm run test:contracts
```

### 9.2 Manual testing checklist
- [ ] Connect Phantom wallet to your dApp
- [ ] Check current pot amount
- [ ] Take a test shot (costs 0.001 ETH)
- [ ] Verify cooldown period
- [ ] Check transaction on Etherscan

## Available pnpm Commands

| Command | Description |
|---------|-------------|
| `pnpm run compile` | Compile smart contracts |
| `pnpm run deploy:testnet` | Deploy to Sepolia (basic) |
| `pnpm run deploy:testnet-advanced` | Deploy to Sepolia (advanced with testing) |
| `pnpm run verify:testnet` | Verify contract on Etherscan |
| `pnpm run test:contracts` | Run contract tests |
| `pnpm run dev` | Start development server |

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"
- Ensure you have enough Sepolia ETH
- Check gas price settings in Phantom

#### 2. "Invalid private key"
- Ensure private key starts with `0x`
- Check for extra spaces or characters

#### 3. "Network mismatch"
- Verify Phantom is connected to Sepolia
- Check RPC URL in both Phantom and `.env`

#### 4. "Contract verification failed"
- Ensure Etherscan API key is correct
- Wait a few minutes after deployment before verifying

### Getting Help

1. Check the console for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure Phantom wallet is unlocked and connected
4. Check Sepolia testnet status at [status.ethereum.org](https://status.ethereum.org)

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use testnet first** before mainnet deployment
3. **Verify contract code** on Etherscan after deployment
4. **Test thoroughly** before going live
5. **Keep backups** of your wallet seed phrase

## Next Steps After Deployment

1. Update frontend with contract address
2. Test all game functionality
3. Deploy frontend to Vercel/Netlify
4. Set up monitoring and analytics
5. Plan mainnet deployment strategy

---

**Need help?** Check the project's GitHub issues or contact the development team.