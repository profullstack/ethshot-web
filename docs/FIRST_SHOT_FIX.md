# First Shot Error Fix

## Problem
Users were getting errors when taking the first shot in production. The error was caused by a mismatch between the contract's expected payment amount and the actual payment sent.

## Root Cause
1. **Contract's SHOT_COST**: 0.0005 ETH (from deployment.json)
2. **FIRST_SHOT_COST_ETH**: 0.001 ETH (from config.js default)
3. **GameActions.takeShot()** was using `customShotCost: GAME_CONFIG.FIRST_SHOT_COST_ETH` (0.001 ETH)
4. **Contract modifier**: `correctPayment(SHOT_COST)` requires exactly 0.0005 ETH

The contract was rejecting transactions because it received 0.001 ETH when it expected exactly 0.0005 ETH.

## Solution

### 1. Fixed GameActions.takeShot()
**File**: `src/lib/services/game-actions.js`

**Before**:
```javascript
const shotCost = customShotCost ? ethers.parseEther(customShotCost) : await contract.SHOT_COST();
```

**After**:
```javascript
// CRITICAL FIX: Always use contract's SHOT_COST for transaction
// Custom shot costs are handled at UI/database level for display only
const shotCost = await contract.SHOT_COST();
```

### 2. Updated Balance Check
**File**: `src/lib/services/game-actions.js`

Added proper balance checking that accounts for both actual transaction cost and custom cost:
```javascript
// For balance check, use the higher of actual cost or custom cost
const balanceCheckCost = customShotCost ? 
  Math.max(ethers.parseEther(customShotCost), shotCost) + estimatedGasCost : 
  totalCost;
```

### 3. Fixed Database Logging
**File**: `src/lib/services/game-actions.js`

Updated to use custom shot cost for display purposes:
```javascript
// Use custom shot cost for display purposes if provided
const displayAmount = customShotCost ? customShotCost : ethers.formatEther(shotCost);
```

### 4. Updated Configuration
**Files**: `src/lib/config.js`, `src/lib/config-server.js`

Changed default values to match contract:
```javascript
// Before
FIRST_SHOT_COST_ETH: '0.001'

// After  
FIRST_SHOT_COST_ETH: '0.0005'
```

## Key Changes Made

1. **Always use contract's SHOT_COST for transactions** - This ensures the contract receives exactly what it expects
2. **Handle custom costs at UI/database level** - Custom costs are only used for display and balance checking
3. **Updated configuration defaults** - First shot cost now matches regular shot cost
4. **Improved balance checking** - Accounts for both actual and custom costs

## Testing
The fix ensures that:
- First shots use exactly 0.0005 ETH (contract's SHOT_COST)
- Balance checks account for the actual cost
- Database records show the correct amount for display
- No more "Incorrect payment" errors from the contract

## Deployment
This fix is now deployed to production and should resolve the first shot errors. 