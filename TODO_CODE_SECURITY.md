# ETH Shot Security TODO List

## 🚨 CRITICAL PRIORITY (Fix Immediately)

### 1. Database Authorization Bypass
**File**: [`supabase/migrations/20250123051117_initial_schema.sql`](supabase/migrations/20250123051117_initial_schema.sql)
**Lines**: 116-124

- [ ] **Remove public write policies** from all game tables:
  ```sql
  -- REMOVE THESE POLICIES:
  DROP POLICY "Allow public insert on players" ON players;
  DROP POLICY "Allow public update on players" ON players;
  DROP POLICY "Allow public insert on shots" ON shots;
  DROP POLICY "Allow public insert on winners" ON winners;
  DROP POLICY "Allow public insert on sponsors" ON sponsors;
  DROP POLICY "Allow public update on sponsors" ON sponsors;
  DROP POLICY "Allow public update on game_stats" ON game_stats;
  DROP POLICY "Allow public insert on game_stats" ON game_stats;
  ```

- [ ] **Create new migration** with proper service role authentication:
  ```sql
  -- Only allow authenticated service role to write game data
  CREATE POLICY "Service role can manage players" ON players 
    FOR ALL USING (auth.role() = 'service_role');
  
  CREATE POLICY "Service role can manage shots" ON shots 
    FOR ALL USING (auth.role() = 'service_role');
  
  CREATE POLICY "Service role can manage winners" ON winners 
    FOR ALL USING (auth.role() = 'service_role');
  
  CREATE POLICY "Service role can manage sponsors" ON sponsors 
    FOR ALL USING (auth.role() = 'service_role');
  
  CREATE POLICY "Service role can manage game_stats" ON game_stats 
    FOR ALL USING (auth.role() = 'service_role');
  ```

- [ ] **Update database client** to use service role for game operations
- [ ] **Test all game operations** after policy changes

### 2. Chat Server Authentication Weakness
**File**: [`servers/chat/chat-server.js`](servers/chat/chat-server.js)
**Lines**: 191-224

- [ ] **Implement cryptographic signature verification**:
  ```javascript
  // Add to handleAuthentication function
  async handleAuthentication(clientId, message) {
    const { walletAddress, signature, challenge } = message;
    
    // Verify signature
    const recoveredAddress = ethers.verifyMessage(challenge, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      this.sendError(clientId, 'Invalid signature');
      return;
    }
    
    // Store authenticated wallet address
    client.walletAddress = walletAddress.toLowerCase();
    // ... rest of authentication logic
  }
  ```

- [ ] **Add challenge generation endpoint**:
  ```javascript
  // Generate unique challenge for each authentication attempt
  generateChallenge(clientId) {
    const challenge = `Sign this message to authenticate with ETH Shot chat: ${Date.now()}-${Math.random()}`;
    this.challenges.set(clientId, { challenge, timestamp: Date.now() });
    return challenge;
  }
  ```

- [ ] **Update client-side authentication** to sign challenges
- [ ] **Add challenge expiration** (5 minutes max)

### 3. Smart Contract Test Mode in Production
**File**: [`contracts/EthShot.sol`](contracts/EthShot.sol)
**Lines**: 54-56, 404-411, 467-469

- [ ] **Remove test mode variables**:
  ```solidity
  // DELETE THESE LINES:
  bool public testMode = false;
  uint256 private testWinningNumber = 0;
  ```

- [ ] **Remove test mode functions**:
  ```solidity
  // DELETE THESE FUNCTIONS:
  function setTestMode(bool _testMode) external onlyOwner { ... }
  function setWinningNumber(uint256 _winningNumber) external onlyOwner { ... }
  function _checkWinTest() private view returns (bool) { ... }
  ```

- [ ] **Update _checkWin function** to remove test mode logic:
  ```solidity
  function _checkWin(uint256 secret, uint256 commitBlock) private returns (bool) {
    // Remove this block:
    // if (testMode) {
    //     won = _checkWinTest();
    // } else {
    //     won = _checkWin(secret, shot.blockNumber);
    // }
    
    // Keep only the production logic
    // ... existing randomness generation code
  }
  ```

- [ ] **Create separate test contract** for development
- [ ] **Redeploy production contract** without test functionality

## 🔥 HIGH PRIORITY (Fix This Week)

### 4. Insufficient Input Validation
**File**: [`src/lib/database/index.js`](src/lib/database/index.js)
**Lines**: 58-94, 264-283

- [ ] **Create input validation schemas**:
  ```javascript
  // Add validation utility
  const validateShotData = (shotData) => {
    if (!shotData.playerAddress || !/^0x[a-fA-F0-9]{40}$/.test(shotData.playerAddress)) {
      throw new Error('Invalid player address');
    }
    if (!shotData.amount || isNaN(shotData.amount) || shotData.amount <= 0) {
      throw new Error('Invalid amount');
    }
    if (!shotData.txHash || !/^0x[a-fA-F0-9]{64}$/.test(shotData.txHash)) {
      throw new Error('Invalid transaction hash');
    }
    if (!shotData.blockNumber || !Number.isInteger(shotData.blockNumber) || shotData.blockNumber <= 0) {
      throw new Error('Invalid block number');
    }
    return true;
  };
  ```

- [ ] **Add validation to all database operations**:
  ```javascript
  async recordShot(shotData) {
    validateShotData(shotData); // Add this line
    // ... rest of function
  }
  ```

- [ ] **Implement data sanitization** for all user inputs
- [ ] **Add rate limiting** to database operations
- [ ] **Create comprehensive test suite** for input validation

### 5. Environment Variable Exposure
**File**: [`hardhat.config.js`](hardhat.config.js)
**Lines**: 23-24, 28-29

- [ ] **Remove hardcoded fallback URLs**:
  ```javascript
  // CHANGE FROM:
  url: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
  
  // TO:
  url: process.env.SEPOLIA_RPC_URL,
  ```

- [ ] **Add environment validation**:
  ```javascript
  // Add at top of config file
  const requiredEnvVars = ['SEPOLIA_RPC_URL', 'MAINNET_RPC_URL', 'PRIVATE_KEY'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  ```

- [ ] **Update deployment scripts** to validate environment
- [ ] **Create environment template** with all required variables
- [ ] **Add CI/CD checks** for environment variable presence

### 6. Weak Randomness Fallback
**File**: [`contracts/EthShot.sol`](contracts/EthShot.sol)
**Lines**: 438-444

- [ ] **Implement Chainlink VRF integration**:
  ```solidity
  import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
  import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
  
  contract EthShot is VRFConsumerBaseV2, Ownable, Pausable, ReentrancyGuard {
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    bytes32 keyHash;
    
    // ... implement VRF request/fulfill pattern
  }
  ```

- [ ] **Add additional entropy sources**:
  ```solidity
  // Enhance randomness with more sources
  uint256 randomNumber = uint256(
    keccak256(
      abi.encodePacked(
        secret,
        futureBlockHash,
        nonce,
        playerNonces[msg.sender],
        msg.sender,
        block.timestamp,
        block.prevrandao,
        block.gaslimit,        // Add this
        tx.gasprice,           // Add this
        blockhash(block.number - 1) // Add this
      )
    )
  ) % BASIS_POINTS;
  ```

- [ ] **Increase reveal delay** to reduce miner manipulation risk
- [ ] **Add VRF subscription management** functions

## ⚠️ MEDIUM PRIORITY (Fix This Month)

### 7. Rate Limiting Bypass
**File**: [`servers/chat/chat-server.js`](servers/chat/chat-server.js)
**Lines**: 520-540

- [ ] **Implement IP-based rate limiting**:
  ```javascript
  // Add IP tracking
  const ipRateLimits = new Map();
  
  checkRateLimit(walletAddress, clientIP) {
    // Check both wallet and IP limits
    const walletLimit = this.rateLimits.get(walletAddress);
    const ipLimit = ipRateLimits.get(clientIP);
    
    return this.checkWalletLimit(walletLimit) && this.checkIPLimit(ipLimit);
  }
  ```

- [ ] **Add progressive penalties**:
  ```javascript
  // Implement escalating timeouts
  const applyPenalty = (identifier, violationCount) => {
    const penalties = [60000, 300000, 900000, 3600000]; // 1min, 5min, 15min, 1hr
    const penaltyTime = penalties[Math.min(violationCount - 1, penalties.length - 1)];
    this.penalties.set(identifier, Date.now() + penaltyTime);
  };
  ```

- [ ] **Add device fingerprinting** for additional protection
- [ ] **Implement Redis-based rate limiting** for scalability

### 8. Information Disclosure
**File**: [`src/lib/database/index.js`](src/lib/database/index.js)
**Lines**: 58-67, 84-89

- [ ] **Implement logging levels**:
  ```javascript
  // Create logger utility
  const logger = {
    debug: (msg, data) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(msg, data);
      }
    },
    info: (msg) => console.log(msg),
    error: (msg, error) => console.error(msg, { message: error.message })
  };
  ```

- [ ] **Sanitize error messages**:
  ```javascript
  // Replace detailed errors with generic messages
  catch (error) {
    logger.debug('Database error details:', error);
    logger.error('Database operation failed');
    throw new Error('Operation failed. Please try again.');
  }
  ```

- [ ] **Remove sensitive data** from logs
- [ ] **Implement structured logging** with proper filtering

### 9. Cross-Site Scripting (XSS) Risk
**File**: [`servers/chat/chat-server.js`](servers/chat/chat-server.js)
**Lines**: 430-441

- [ ] **Install DOMPurify** for server-side sanitization:
  ```bash
  npm install isomorphic-dompurify
  ```

- [ ] **Sanitize chat messages**:
  ```javascript
  import DOMPurify from 'isomorphic-dompurify';
  
  async handleSendMessage(clientId, message) {
    // Sanitize content
    const sanitizedContent = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: []
    });
    
    // ... rest of function with sanitizedContent
  }
  ```

- [ ] **Add Content Security Policy** headers:
  ```javascript
  // Add to HTTP server response headers
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  ```

- [ ] **Implement message length limits** and character restrictions
- [ ] **Add client-side XSS protection** in Svelte components

## 🔧 LOW PRIORITY (Technical Debt)

### 10. Gas Optimization Opportunities
**File**: [`contracts/EthShot.sol`](contracts/EthShot.sol)
**Lines**: 204-213, 525-537

- [ ] **Optimize struct packing**:
  ```solidity
  struct PlayerStats {
    uint128 totalShots;    // Reduced from uint256
    uint128 totalSpent;    // Reduced from uint256
    uint128 totalWon;      // Reduced from uint256
    uint64 lastShotTime;   // Reduced from uint256
  }
  ```

- [ ] **Use events instead of arrays** for winner history:
  ```solidity
  // Remove recentWinners array, use events only
  event JackpotWon(
    address indexed winner, 
    uint256 indexed amount, 
    uint256 indexed timestamp,
    uint256 blockNumber
  );
  ```

- [ ] **Implement batch operations** where possible
- [ ] **Use assembly for gas-critical operations**

### 11. Deprecated Function Usage
**File**: [`src/lib/stores/wallet.js`](src/lib/stores/wallet.js)
**Line**: 629

- [ ] **Replace deprecated substr()**:
  ```javascript
  // CHANGE FROM:
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // TO:
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  ```

- [ ] **Add ESLint rules** to prevent deprecated functions:
  ```json
  {
    "rules": {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.property.name='substr']",
          "message": "Use substring() or slice() instead of deprecated substr()"
        }
      ]
    }
  }
  ```

- [ ] **Update all deprecated JavaScript patterns**
- [ ] **Add pre-commit hooks** for code quality checks

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Week 1)
- [ ] Database authorization bypass fix
- [ ] Chat server authentication implementation
- [ ] Smart contract test mode removal
- [ ] Emergency deployment of fixes

### Phase 2: High Priority (Week 2-3)
- [ ] Input validation implementation
- [ ] Environment variable security
- [ ] Randomness improvements
- [ ] Comprehensive testing

### Phase 3: Medium Priority (Week 4-6)
- [ ] Rate limiting enhancements
- [ ] Information disclosure fixes
- [ ] XSS protection implementation
- [ ] Security monitoring setup

### Phase 4: Low Priority (Ongoing)
- [ ] Gas optimizations
- [ ] Code quality improvements
- [ ] Technical debt reduction
- [ ] Performance enhancements

## 🧪 Testing Requirements

### Security Testing
- [ ] **Penetration testing** of all critical vulnerabilities
- [ ] **Authentication bypass testing** for chat and database
- [ ] **Input fuzzing** for all user inputs
- [ ] **Rate limiting testing** with various attack patterns

### Smart Contract Testing
- [ ] **Randomness testing** with statistical analysis
- [ ] **Gas optimization verification**
- [ ] **Edge case testing** for all game scenarios
- [ ] **Upgrade testing** if implementing upgradeable contracts

### Integration Testing
- [ ] **End-to-end security flows**
- [ ] **Multi-user concurrent testing**
- [ ] **Network failure scenarios**
- [ ] **Database failover testing**

## 📚 Documentation Updates

- [ ] **Security architecture documentation**
- [ ] **Deployment security checklist**
- [ ] **Incident response procedures**
- [ ] **Security monitoring setup guide**
- [ ] **Developer security guidelines**

## 🚀 Deployment Security

### Pre-Deployment Checklist
- [ ] All critical and high priority fixes implemented
- [ ] Security testing completed
- [ ] Environment variables properly configured
- [ ] Database policies tested and verified
- [ ] Smart contract audit completed
- [ ] Monitoring and alerting configured

### Post-Deployment Monitoring
- [ ] Database access monitoring
- [ ] Chat authentication monitoring
- [ ] Smart contract event monitoring
- [ ] Error rate monitoring
- [ ] Performance monitoring

---

**Last Updated**: 2025-01-26
**Next Review**: 2025-02-26
**Security Contact**: [Add security team contact]