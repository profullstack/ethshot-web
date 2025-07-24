# ETH Shot 🎯

A viral Ethereum-powered game where users pay 0.001 ETH per shot for a 1% chance to win the jackpot.

## 🎮 Game Overview

ETH Shot is a decentralized gambling game built on Ethereum where players take shots at winning the jackpot. Each shot costs 0.001 ETH with a 1% chance of winning the entire pot. The game features real-time updates, social sharing, and sponsor integration.

## ✨ Features

- **🎯 Smart Contract Game**: Built on Ethereum with provably fair 1% win probability
- **💰 Dynamic Jackpot**: Pot grows with each shot, 90% goes to winner
- **🔒 Wallet Integration**: Connect with MetaMask, WalletConnect, and other Web3 wallets
- **⚡ Real-time Updates**: Live pot updates and winner announcements via Supabase
- **⏰ Cooldown System**: 1-hour cooldown between shots per wallet address
- **🎪 Sponsor Rounds**: Businesses can sponsor rounds for 0.05 ETH with custom branding
- **📱 Social Sharing**: Share wins and game stats on Twitter
- **🎨 Winner Animations**: Confetti and celebration effects for jackpot wins
- **📊 Leaderboards**: Track top players and recent winners
- **📱 Responsive Design**: Optimized for desktop and mobile devices

## 🛠 Tech Stack

### Smart Contract
- **Solidity**: Smart contract development
- **OpenZeppelin**: Security libraries (ReentrancyGuard, Pausable, Ownable)
- **Hardhat**: Development environment and testing

### Frontend
- **SvelteKit**: Modern web framework with SSR
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Ethers.js v6**: Ethereum interaction library
- **Web3Modal**: Multi-wallet connection

### Backend & Database
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Real-time subscriptions**: Live updates for winners, shots, and sponsors

### Testing & Quality
- **Mocha + Chai**: JavaScript testing framework
- **Hardhat**: Smart contract testing
- **ESLint + Prettier**: Code formatting and linting
- **Sinon**: Mocking and stubbing for tests

### Deployment
- **Vercel**: Frontend hosting and deployment
- **Sepolia Testnet**: Ethereum testnet for testing

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- MetaMask or other Web3 wallet
- Infura/Alchemy API key
- Supabase account

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/ethshot-web.git
cd ethshot-web
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Smart Contract Configuration
VITE_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
VITE_RPC_URL=https://sepolia.infura.io/v3/your-infura-key

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Configuration
VITE_APP_URL=https://ethshot.io
VITE_NETWORK_NAME=Sepolia Testnet
VITE_CHAIN_ID=11155111
```

4. **Start the development server:**
```bash
pnpm dev
```

5. **Open [http://localhost:5173](http://localhost:5173) in your browser.**

## 📋 Smart Contract

The game is powered by a Solidity smart contract with the following specifications:

### Game Mechanics
- **Shot Cost**: 0.001 ETH per shot
- **Win Probability**: 1% chance to win the jackpot
- **Payout Split**: 90% to winner, 10% to contract owner
- **Cooldown Period**: 1 hour (3600 seconds) between shots per wallet
- **Sponsor Cost**: 0.05 ETH to sponsor a round with custom branding

### Key Functions
- `takeShot()`: Take a shot at the jackpot (payable)
- `sponsorRound(string name, string logoUrl)`: Sponsor a round (payable)
- `getCurrentPot()`: Get current jackpot amount
- `getPlayerStats(address)`: Get player statistics
- `canTakeShot(address)`: Check if player can take a shot
- `getCooldownRemaining(address)`: Get remaining cooldown time

### Security Features
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownable**: Access control for admin functions
- **Randomness**: Uses block hash and timestamp for randomness

## 🧪 Testing

### Run Smart Contract Tests
```bash
pnpm test:contracts
```

### Run Frontend Tests
```bash
pnpm test
```

### Run All Tests
```bash
pnpm test:all
```

### Test Coverage
```bash
pnpm coverage
```

## 🚀 Deployment

### 1. Smart Contract Deployment

**Deploy to Sepolia Testnet:**
```bash
# Configure your private key in hardhat.config.js
pnpm deploy:testnet
```

**Verify Contract on Etherscan:**
```bash
pnpm verify:testnet
```

### 2. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql`
3. Configure Row Level Security (RLS) policies
4. Update environment variables with Supabase credentials

### 3. Frontend Deployment

**Deploy to Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Variables in Vercel:**
- `VITE_CONTRACT_ADDRESS`
- `VITE_RPC_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `VITE_NETWORK_NAME`
- `VITE_CHAIN_ID`

## 📊 Database Schema

The application uses Supabase PostgreSQL with the following tables:

- **shots**: Records all shot attempts
- **winners**: Tracks jackpot winners
- **sponsors**: Manages sponsorship rounds
- **players**: Player statistics and rankings

Real-time subscriptions provide live updates for:
- New winners
- Shot attempts
- Sponsor activations

## 🎨 Components

### Core Components
- **GameButton**: Main "Take the Shot" button with loading states
- **PotDisplay**: Real-time jackpot amount display
- **WalletConnect**: Multi-wallet connection interface
- **WinnerAnimation**: Confetti and celebration effects
- **Leaderboard**: Top players and statistics
- **RecentWinners**: Live winner feed
- **SponsorBanner**: Sponsor branding display

### Stores (State Management)
- **gameStore**: Game state, contract interactions, database integration
- **walletStore**: Wallet connection and Web3 functionality
- **toastStore**: User notifications and feedback

## 🔧 Development Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing
pnpm test             # Run frontend tests
pnpm test:contracts   # Run smart contract tests
pnpm test:all         # Run all tests
pnpm coverage         # Generate test coverage

# Smart Contract
pnpm compile          # Compile contracts
pnpm deploy:testnet   # Deploy to Sepolia
pnpm verify:testnet   # Verify on Etherscan

# Code Quality
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
```

## 🚨 Security Considerations

### Smart Contract Security
- **Audited Libraries**: Uses OpenZeppelin's battle-tested contracts
- **Reentrancy Protection**: ReentrancyGuard prevents reentrancy attacks
- **Access Control**: Ownable pattern for admin functions
- **Emergency Pause**: Pausable functionality for emergency stops
- **Input Validation**: Proper validation of all inputs

### Frontend Security
- **Environment Variables**: Sensitive data stored in environment variables
- **HTTPS Only**: All production traffic over HTTPS
- **Content Security Policy**: Implemented via Vercel headers
- **XSS Protection**: Framework-level XSS protection

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries with proper indexes
- **Real-time Subscriptions**: Efficient WebSocket connections
- **Caching**: Strategic caching of contract calls
- **Code Splitting**: Lazy loading of components
- **Image Optimization**: Optimized assets and images

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `pnpm test:all`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Submit a pull request

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**Important**: This is a game of chance involving real cryptocurrency. Please consider the following:

- **Gambling Risk**: Only gamble with funds you can afford to lose
- **Smart Contract Risk**: Smart contracts may contain bugs or vulnerabilities
- **Regulatory Compliance**: Ensure compliance with local gambling laws
- **No Guarantees**: No guarantees of winnings or returns
- **Educational Purpose**: This project is primarily for educational purposes

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join discussions in GitHub Discussions
- **Community**: Follow updates on Twitter [@profullstackinc](https://twitter.com/profullstackinc)
- **Discord**: Join our community on [Discord](https://discord.gg/w5nHdzpQ29)

## 🎯 Roadmap

### Phase 1 (Current)
- [x] Core game mechanics
- [x] Smart contract deployment
- [x] Frontend application
- [x] Database integration
- [x] Real-time updates

### Phase 2 (Planned)
- [ ] Mobile app development
- [ ] Advanced analytics dashboard
- [ ] NFT rewards for winners
- [ ] Referral system
- [ ] Multiple game modes

### Phase 3 (Future)
- [ ] Layer 2 integration (Polygon, Arbitrum)
- [ ] DAO governance
- [ ] Tournament system
- [ ] Cross-chain compatibility

---

**Built with ❤️ by the ETH Shot team**