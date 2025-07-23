# Multi-Cryptocurrency Architecture

This document describes the refactored architecture that enables ETH Shot to support multiple cryptocurrencies (ETH, SOL, and future additions) while maintaining backward compatibility.

## Overview

The multi-crypto architecture uses the **Adapter Pattern** to abstract cryptocurrency-specific implementations behind a common interface. This allows the application to support different blockchains and their unique characteristics while providing a unified API for the frontend.

## Architecture Components

### 1. Configuration System (`src/lib/crypto/config.js`)

**Purpose**: Centralized configuration for all supported cryptocurrencies.

**Key Features**:
- Cryptocurrency type definitions (`CRYPTO_TYPES`)
- Network configurations for each crypto
- Wallet provider mappings
- Game-specific configurations per crypto
- Formatters and validators for each crypto

**Example Usage**:
```javascript
import { getCryptoConfig, CRYPTO_TYPES } from './crypto/config.js';

const ethConfig = getCryptoConfig(CRYPTO_TYPES.ETH);
console.log(ethConfig.networks.mainnet.chainId); // 1
```

### 2. Adapter Pattern (`src/lib/crypto/adapters/`)

**Purpose**: Provides a unified interface for different cryptocurrency implementations.

#### Base Adapter (`base.js`)
- Defines the common interface all crypto adapters must implement
- Provides shared functionality like formatting and validation
- Ensures consistent behavior across different cryptocurrencies

#### Ethereum Adapter (`ethereum.js`)
- Implements ETH-specific wallet connections (MetaMask, WalletConnect)
- Handles Ethereum smart contract interactions using ethers.js
- Manages Ethereum network switching and transaction signing

#### Solana Adapter (`solana.js`)
- Placeholder implementation for future Solana support
- Will handle Solana wallet connections (Phantom, Solflare)
- Will manage Solana program interactions using @solana/web3.js

#### Adapter Factory (`index.js`)
- Creates and manages adapter instances
- Provides convenience functions for adapter operations
- Handles adapter lifecycle and cleanup

**Example Usage**:
```javascript
import { setActiveCrypto, getActiveAdapter, CRYPTO_TYPES } from './crypto/adapters/index.js';

// Switch to Ethereum
const ethAdapter = setActiveCrypto(CRYPTO_TYPES.ETH);
await ethAdapter.connect('metamask');

// Take a shot
const result = await ethAdapter.takeShot();
```

### 3. Multi-Crypto Stores

#### Wallet Store (`src/lib/stores/wallet-multi-crypto.js`)
- Manages wallet connections for multiple cryptocurrencies
- Handles crypto switching and adapter management
- Provides reactive state for wallet connection status

**Key Features**:
- Support for multiple wallet types per crypto
- Automatic adapter initialization
- Event handling for wallet changes
- Network switching capabilities

#### Game Store (`src/lib/stores/game-multi-crypto.js`)
- Manages game state for multiple cryptocurrencies
- Handles crypto-specific game logic and transactions
- Provides unified game interface regardless of active crypto

**Key Features**:
- Crypto-aware game state management
- Adapter-based transaction handling
- Real-time updates for multi-crypto games
- Database integration with crypto type tracking

### 4. Database Schema Updates

**Migration**: `supabase/migrations/20250723225800_multi_crypto_support.sql`

**Changes**:
- Added `crypto_type` column to all existing tables
- Created `crypto_game_stats` table for per-crypto statistics
- Updated views and functions to be crypto-aware
- Added indexes for optimal multi-crypto queries

**New Functions**:
- `get_crypto_leaderboard(crypto_type, rank_by, limit)`
- `get_crypto_recent_winners(crypto_type, limit)`
- `get_crypto_recent_shots(crypto_type, limit)`
- `update_crypto_game_statistics(crypto_type)`

## Implementation Details

### Cryptocurrency Support Matrix

| Feature | ETH | SOL | Future Cryptos |
|---------|-----|-----|----------------|
| Wallet Connection | ✅ | 🚧 | 📋 |
| Smart Contracts | ✅ | 🚧 | 📋 |
| Transaction Signing | ✅ | 🚧 | 📋 |
| Network Switching | ✅ | 🚧 | 📋 |
| Game Logic | ✅ | 🚧 | 📋 |
| Database Integration | ✅ | ✅ | ✅ |

**Legend**: ✅ Implemented, 🚧 Planned, 📋 Future

### Environment Variables

The system supports crypto-specific environment variables:

```bash
# Ethereum Configuration
VITE_ETH_CONTRACT_ADDRESS=0x...
VITE_ETH_SHOT_COST=0.001
VITE_ETH_SPONSOR_COST=0.05
VITE_ETH_USD_PRICE=2500

# Solana Configuration (Future)
VITE_SOL_PROGRAM_ID=...
VITE_SOL_SHOT_COST=0.01
VITE_SOL_SPONSOR_COST=0.5
VITE_SOL_USD_PRICE=100

# Active Cryptocurrency
VITE_ACTIVE_CRYPTO=ETH
```

### Error Handling

The architecture provides consistent error handling across cryptocurrencies:

1. **Adapter-Level Errors**: Crypto-specific errors are caught and normalized
2. **Store-Level Errors**: User-friendly error messages are provided
3. **UI-Level Errors**: Toast notifications show appropriate error messages
4. **Fallback Behavior**: Graceful degradation when features aren't available

### Testing Strategy

Comprehensive test coverage includes:

1. **Configuration Tests** (`test/crypto/config.test.js`)
   - Validates crypto configurations
   - Tests formatters and validators
   - Ensures proper error handling

2. **Adapter Tests** (`test/crypto/adapters.test.js`)
   - Tests adapter factory functionality
   - Validates base adapter interface
   - Tests crypto-specific implementations

3. **Integration Tests**
   - End-to-end wallet connection flows
   - Multi-crypto game state management
   - Database operations with crypto types

## Migration Guide

### For Existing ETH Users

The refactoring maintains full backward compatibility:

1. **Existing Data**: All ETH data is preserved with `crypto_type = 'ETH'`
2. **API Compatibility**: Original stores still work (deprecated but functional)
3. **Environment Variables**: Existing ETH variables continue to work

### For New Implementations

To add a new cryptocurrency:

1. **Add Crypto Type**: Update `CRYPTO_TYPES` in config
2. **Create Configuration**: Add crypto config to `CRYPTO_REGISTRY`
3. **Implement Adapter**: Create new adapter extending `BaseCryptoAdapter`
4. **Update Database**: Add crypto type to constraints and functions
5. **Add Tests**: Create comprehensive test coverage

### Example: Adding Bitcoin Support

```javascript
// 1. Add to CRYPTO_TYPES
export const CRYPTO_TYPES = {
  ETH: 'ETH',
  SOL: 'SOL',
  BTC: 'BTC'  // New
};

// 2. Create BTC configuration
export const BTC_CONFIG = createCryptoConfig({
  type: CRYPTO_TYPES.BTC,
  name: 'Bitcoin',
  symbol: 'BTC',
  decimals: 8,
  // ... other config
});

// 3. Implement BitcoinAdapter
export class BitcoinAdapter extends BaseCryptoAdapter {
  // Implement all required methods
}

// 4. Register adapter
const ADAPTER_REGISTRY = {
  [CRYPTO_TYPES.ETH]: EthereumAdapter,
  [CRYPTO_TYPES.SOL]: SolanaAdapter,
  [CRYPTO_TYPES.BTC]: BitcoinAdapter  // New
};
```

## Performance Considerations

### Adapter Caching
- Adapters are created once and reused
- Network calls are cached with TTL
- Database queries are optimized with crypto-specific indexes

### Lazy Loading
- Crypto libraries are dynamically imported
- Adapters are initialized only when needed
- UI components load crypto-specific features on demand

### Memory Management
- Adapters are properly cleaned up on disconnect
- Event listeners are removed to prevent memory leaks
- Cache is cleared when switching cryptocurrencies

## Security Considerations

### Wallet Security
- Private keys never leave the user's wallet
- All transactions require explicit user approval
- Network switching is validated before execution

### Smart Contract Security
- Contract addresses are validated before use
- ABI definitions are immutable and verified
- Gas estimation prevents transaction failures

### Data Validation
- All crypto addresses are validated before use
- Amount formatting prevents precision errors
- Network configurations are type-checked

## Future Roadmap

### Phase 1: Solana Implementation
- Complete Solana adapter implementation
- Add Solana wallet integrations
- Deploy Solana program equivalent
- Enable SOL game functionality

### Phase 2: Additional Cryptocurrencies
- Research and evaluate other cryptocurrencies
- Implement adapters for selected cryptos
- Add cross-chain functionality
- Optimize for multiple simultaneous connections

### Phase 3: Advanced Features
- Multi-crypto portfolio tracking
- Cross-chain arbitrage opportunities
- Unified leaderboards across cryptos
- Advanced analytics and reporting

## Troubleshooting

### Common Issues

1. **Adapter Not Found**
   ```
   Error: No adapter found for cryptocurrency type: XYZ
   ```
   **Solution**: Ensure the crypto type is registered in `ADAPTER_REGISTRY`

2. **Network Mismatch**
   ```
   Error: Network mainnet not found in ETH configuration
   ```
   **Solution**: Check network configuration in crypto config

3. **Wallet Connection Failed**
   ```
   Error: Solana support not yet implemented
   ```
   **Solution**: Use ETH for now, SOL support coming soon

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('debug', 'crypto:*');
```

This will show detailed logs for all crypto operations.

## Contributing

When contributing to the multi-crypto architecture:

1. **Follow Patterns**: Use existing adapter patterns
2. **Add Tests**: Ensure comprehensive test coverage
3. **Update Documentation**: Keep this document current
4. **Consider Security**: Review all crypto-related code carefully
5. **Test Thoroughly**: Test with real wallets and networks

## Conclusion

The multi-crypto architecture provides a solid foundation for supporting multiple cryptocurrencies while maintaining code quality, security, and user experience. The adapter pattern ensures that adding new cryptocurrencies is straightforward and doesn't require changes to existing code.

The architecture is designed to be:
- **Extensible**: Easy to add new cryptocurrencies
- **Maintainable**: Clear separation of concerns
- **Testable**: Comprehensive test coverage
- **Secure**: Proper validation and error handling
- **Performant**: Optimized for real-world usage

This refactoring positions ETH Shot for future growth and multi-blockchain support while preserving the existing ETH functionality that users rely on.