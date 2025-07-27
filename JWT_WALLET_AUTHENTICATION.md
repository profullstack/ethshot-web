# JWT-Based Wallet Authentication System

## Overview

This document describes the new secure JWT-based wallet authentication system that replaces the problematic email/password approach. This system eliminates Supabase rate limiting issues while providing secure, wallet-based authentication with Row-Level Security (RLS).

## Architecture

### Key Components

1. **JWT Authentication Utilities** (`src/lib/utils/jwt-wallet-auth.js`)
   - Nonce generation and signature verification
   - JWT token creation and validation
   - Wallet address validation and checksumming

2. **Authentication Service** (`src/lib/services/wallet-auth-service.js`)
   - High-level authentication flow management
   - Database operations for nonce storage
   - User session management

3. **New Wallet Authentication** (`src/lib/utils/new-wallet-auth.js`)
   - Replacement for the old problematic authentication flow
   - Supabase integration with custom JWT tokens
   - Session management and validation

4. **Database Schema** (`supabase/migrations/20250127104333_fix_wallet_jwt_authentication.sql`)
   - `users` table for wallet addresses and nonces
   - RLS policies for secure data access
   - Proper type casting for wallet address comparisons

## Authentication Flow

### Step-by-Step Process

1. **Connect Wallet**
   - User connects their wallet (MetaMask, Phantom, etc.)
   - Wallet address is captured and validated

2. **Generate Nonce**
   ```javascript
   const nonceResult = await generateAuthNonce(walletAddress);
   // Returns: { success: true, nonce, message, walletAddress }
   ```

3. **Sign Message**
   ```javascript
   const signature = await signer.signMessage(nonceResult.message);
   ```

4. **Verify and Authenticate**
   ```javascript
   const authResult = await verifyAndAuthenticate(walletAddress, signature);
   // Returns: { success: true, jwtToken, walletAddress, message }
   ```

5. **Supabase Authentication**
   ```javascript
   const { data, error } = await supabase.auth.signInWithCustomToken({
     token: authResult.jwtToken
   });
   ```

## Key Features

### Security Benefits

- **No Rate Limiting**: Bypasses Supabase's email/password rate limits
- **Signature Verification**: Server-side signature validation prevents spoofing
- **Unique Nonces**: Prevents replay attacks with timestamp-based nonces
- **JWT Tokens**: Secure, stateless authentication tokens
- **RLS Integration**: Wallet addresses work seamlessly with Row-Level Security

### Technical Advantages

- **Type Safety**: Proper type casting for wallet address comparisons
- **Concurrent Protection**: Prevents multiple simultaneous authentication attempts
- **Error Handling**: Comprehensive error handling with retry logic
- **Session Management**: Automatic session refresh and validation

## Usage Examples

### Basic Authentication

```javascript
import { authenticateWithWalletJWT } from '../lib/utils/new-wallet-auth.js';

// In your wallet connection logic
try {
  const result = await authenticateWithWalletJWT(walletAddress, signer);
  console.log('Authentication successful:', result);
  // result contains: { success, user, session, jwtToken, walletAddress, authMethod }
} catch (error) {
  console.error('Authentication failed:', error.message);
}
```

### Check Authentication Status

```javascript
import { getAuthStatusJWT, isAuthenticatedForWalletJWT } from '../lib/utils/new-wallet-auth.js';

// Check general auth status
const status = await getAuthStatusJWT();
console.log('Auth status:', status);

// Check for specific wallet
const isAuthed = await isAuthenticatedForWalletJWT(walletAddress);
console.log('Authenticated for wallet:', isAuthed);
```

### Service-Level Operations

```javascript
import { 
  generateAuthNonce, 
  verifyAndAuthenticate,
  validateAuthToken 
} from '../lib/services/wallet-auth-service.js';

// Generate nonce for signing
const nonceResult = await generateAuthNonce(walletAddress);

// Verify signature and get JWT
const authResult = await verifyAndAuthenticate(walletAddress, signature);

// Validate existing token
const validation = await validateAuthToken(jwtToken);
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    wallet_address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

### RLS Policies

The system includes comprehensive RLS policies that use wallet addresses as the authentication identifier:

```sql
-- Users can only access their own data
CREATE POLICY "Users can view own data only"
ON users FOR SELECT USING (
  wallet_address = CAST(auth.uid() AS TEXT)
);

-- Similar policies for other tables (players, shots, winners, sponsors)
```

## Environment Variables

### Required Configuration

```bash
# Supabase JWT Secret (required for token generation/verification)
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Optional: Supabase URL and Anon Key (if not already configured)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Getting Your JWT Secret

1. Go to your Supabase Dashboard
2. Navigate to Settings > API
3. Copy the JWT Secret (not the anon key)
4. Add it to your environment variables

## Testing

### Running Tests

```bash
# Run JWT authentication utility tests
npx mocha tests/jwt-wallet-auth.test.js

# Run wallet authentication service tests
npx mocha tests/wallet-auth-service.test.js

# Run all tests
pnpm test
```

### Test Coverage

The system includes comprehensive tests covering:
- Nonce generation and validation
- Signature verification
- JWT token creation and validation
- Authentication service operations
- Error handling and edge cases
- Integration flows

## Migration from Old System

### What Changed

1. **No More Email/Password**: Eliminates the `address@domain.com` workaround
2. **Direct JWT Tokens**: Uses Supabase's `signInWithCustomToken` method
3. **Proper RLS**: Wallet addresses work directly with Row-Level Security
4. **Better Error Handling**: No more rate limiting issues

### Migration Steps

1. **Update Imports**: Replace old authentication imports with new ones
2. **Update Function Calls**: Use new authentication functions
3. **Test Thoroughly**: Ensure all authentication flows work correctly
4. **Deploy Database**: Run the migration to update your database schema

### Example Migration

```javascript
// OLD (problematic)
import { authenticateWithWallet } from '../lib/utils/wallet-auth.js';

// NEW (secure)
import { authenticateWithWalletJWT } from '../lib/utils/new-wallet-auth.js';

// Usage remains similar, but more reliable
const result = await authenticateWithWalletJWT(walletAddress, signer);
```

## Troubleshooting

### Common Issues

1. **JWT Secret Missing**
   - Error: "SUPABASE_JWT_SECRET is required"
   - Solution: Add the JWT secret to your environment variables

2. **Type Casting Errors**
   - Error: "operator does not exist: text = uuid"
   - Solution: The migration handles this with proper type casting

3. **Signature Verification Fails**
   - Error: "Invalid signature"
   - Solution: Ensure the message being signed matches exactly

4. **RLS Policy Blocks Access**
   - Error: Permission denied
   - Solution: Verify wallet address matches the authenticated user

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=wallet-auth
```

## Performance Considerations

### Optimizations

- **Connection Pooling**: Reuses database connections
- **Concurrent Protection**: Prevents duplicate authentication attempts
- **Session Caching**: Reduces database queries for session validation
- **Indexed Queries**: Database indexes on wallet addresses for fast lookups

### Monitoring

Monitor these metrics:
- Authentication success/failure rates
- JWT token generation time
- Database query performance
- RLS policy evaluation time

## Security Best Practices

### Implementation Guidelines

1. **Always Verify Server-Side**: Never trust client-side signature verification
2. **Use Unique Nonces**: Include timestamps to prevent replay attacks
3. **Validate Wallet Addresses**: Use checksummed addresses consistently
4. **Secure JWT Secrets**: Keep JWT secrets secure and rotate regularly
5. **Monitor Authentication**: Log authentication attempts and failures

### Security Features

- **Replay Attack Prevention**: Timestamp-based nonces
- **Signature Verification**: Server-side cryptographic verification
- **Session Management**: Automatic token expiration and refresh
- **Access Control**: RLS policies enforce data isolation

## Support and Maintenance

### Regular Tasks

1. **Monitor Logs**: Check for authentication failures
2. **Update Dependencies**: Keep JWT and crypto libraries updated
3. **Rotate Secrets**: Periodically rotate JWT secrets
4. **Performance Review**: Monitor authentication performance

### Getting Help

For issues or questions:
1. Check the test files for usage examples
2. Review error messages and logs
3. Verify environment configuration
4. Test with a minimal example

## Conclusion

This JWT-based wallet authentication system provides a secure, scalable, and reliable alternative to the problematic email/password approach. It eliminates rate limiting issues while maintaining strong security through cryptographic signature verification and proper session management.

The system is production-ready and includes comprehensive testing, proper error handling, and detailed documentation for easy maintenance and troubleshooting.