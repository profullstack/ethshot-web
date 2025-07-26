# ETH Shot Deployment Checklist

## Commit-Reveal Randomness Implementation

This checklist ensures that all components of the commit-reveal randomness implementation are ready for production deployment.

### Smart Contract

- [x] Implement commit-reveal mechanism in EthShot.sol
- [x] Remove Chainlink VRF dependencies
- [x] Add commitShot and revealShot functions
- [x] Implement proper validation and security checks
- [x] Conduct full security audit
- [x] Deploy to testnet for testing
- [ ] Deploy final version to mainnet

### Frontend Components

- [x] Update GameButton.svelte for two-step commit-reveal UI
- [x] Update BonusShotButton.svelte for commit-reveal flow
- [x] Update DiscountButton.svelte for commit-reveal flow
- [x] Ensure all UI states properly reflect commit/reveal phases
- [x] Verify error handling and user feedback
- [x] Test responsive design on mobile devices

### Game Store Logic

- [x] Refactor game-unified.js to modular game store architecture
- [x] Implement takeShot function with proper validation
- [x] Implement revealShot function with outcome handling
- [x] Add support for bonus shots in commit-reveal flow
- [x] Add support for discounts in commit-reveal flow
- [x] Ensure proper error handling and recovery
- [x] Implement local storage persistence for pending shots

### Database Integration

- [x] Update database schema for commit-reveal fields
- [x] Implement recordShotCommit function
- [x] Implement updateShotResult function
- [x] Add real-time subscriptions for commit-reveal events
- [x] Test database performance with high load

### Testing

- [x] Update unit tests for commit-reveal functionality
- [x] Add specific tests for bonus shot integration
- [x] Add specific tests for discount integration
- [x] Test full user flow with regular shots
- [x] Test full user flow with bonus shots
- [x] Test full user flow with discounts
- [ ] Perform end-to-end testing in testnet environment

### Documentation

- [x] Create comprehensive commit-reveal documentation
- [x] Update README.md with new flow information
- [x] Document API changes for external integrations
- [x] Provide deployment instructions

## Pre-deployment Integration Testing

Before final deployment, verify the following integrated flows:

### Regular Shot Flow

1. [ ] User connects wallet
2. [ ] User commits a regular shot (pays ETH)
3. [ ] UI updates to show pending shot
4. [ ] User reveals shot after required blocks
5. [ ] Result (win/loss) is properly displayed
6. [ ] Database records are correctly updated

### Bonus Shot Flow

1. [ ] User has bonus shots available
2. [ ] User commits using a bonus shot (no ETH required)
3. [ ] Bonus shot count decrements correctly
4. [ ] UI updates to show pending shot
5. [ ] User reveals shot after required blocks
6. [ ] Result (win/loss) is properly displayed
7. [ ] Database records correctly show bonus shot usage

### Discount Shot Flow

1. [ ] User has discount available
2. [ ] User commits using a discount (reduced ETH required)
3. [ ] Discount is marked as used
4. [ ] UI updates to show pending shot
5. [ ] User reveals shot after required blocks
6. [ ] Result (win/loss) is properly displayed
7. [ ] Database records correctly show discount usage

## Deployment Steps

1. [ ] Ensure all tests pass
2. [ ] Build production frontend assets
3. [ ] Deploy updated backend/database
4. [ ] Deploy smart contract to mainnet
5. [ ] Update frontend configuration with new contract address
6. [ ] Deploy frontend to production
7. [ ] Perform smoke test in production environment
8. [ ] Monitor initial transactions and system performance
