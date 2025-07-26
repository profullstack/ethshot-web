# Commit-Reveal Randomness Scheme

## Overview

ETH Shot uses a commit-reveal scheme for generating provably fair randomness on-chain. This document explains the mechanism, its implementation, and how it integrates with other game features like discounts and bonus shots.

## Why Commit-Reveal?

The commit-reveal scheme prevents front-running and manipulation by:

1. **Preventing Miners/Validators from Knowing Outcomes**: By committing to a hidden value first, then revealing it later, miners/validators cannot know the outcome when they process the transaction.
2. **Preventing Front-Running**: Players cannot see other players' secrets before committing their own.
3. **Ensuring Fairness**: The randomness is derived from both player input (secret) and blockchain data (player address), making it unpredictable yet verifiable.

## How It Works

### 1. Commit Phase

The player first commits a hash of a secret value combined with their address:

1. Player generates a random secret value locally
2. Player creates a commitment hash: `keccak256(abi.encodePacked(secret, playerAddress))`
3. Player sends a transaction with this commitment hash and the shot cost
4. Contract stores the commitment and waits for the reveal

### 2. Reveal Phase

After the commitment transaction is confirmed, the player reveals their secret:

1. Player sends a transaction with their original secret
2. Contract verifies that `keccak256(abi.encodePacked(secret, msg.sender))` matches the stored commitment
3. Contract computes the random outcome using the revealed secret and other on-chain data
4. If the outcome is a win, the player receives the jackpot

## Integration with Game Features

### Discount System

The commit-reveal flow fully supports the discount system:

1. When committing with a discount:
   - The discount percentage is applied to the shot cost
   - The discount is marked as used in the database
   - The transaction is sent with the discounted amount

2. Shot records in the database track whether a discount was used, the discount ID, and the discount percentage.

### Bonus Shot System

Bonus shots earned through referrals can be used in the commit-reveal flow:

1. When committing with a bonus shot:
   - Validation checks if the player has available bonus shots
   - No ETH is required for the transaction (free shot)
   - The bonus shot count is decremented upon successful commit
   - The database records that a bonus shot was used

2. The reveal process works identically whether a standard shot, discounted shot, or bonus shot was used.

## Implementation Details

### Game Store

The unified game store handles the commit-reveal flow with these key functions:

1. `commitShot(useDiscount, discountId, useBonus)`: Handles the commitment phase
   - Generates secret and commitment
   - Handles discount and bonus shot logic
   - Sends the transaction to the contract
   - Stores pending shot data in state and localStorage

2. `revealShot()`: Handles the reveal phase
   - Retrieves the stored secret and commitment
   - Sends the reveal transaction
   - Processes the outcome (win/loss)
   - Updates player statistics and UI

3. `claimPayout()`: For claiming winnings after a successful reveal

### State Management

The game store maintains several important state properties:

- `pendingShot`: Information about a shot waiting to be revealed
- `bonusShotsAvailable`: Number of bonus shots available to the player
- `availableDiscounts`: List of discounts available to the player
- `canCommitShot` & `canRevealShot`: Derived stores indicating when actions are possible

### Database Integration

The Supabase database tracks the complete commit-reveal process:

1. `recordShotCommit`: Records the commitment transaction
2. `updateShotResult`: Updates the record with reveal outcome
3. `recordPayoutClaim`: Records when a winner claims their jackpot

Real-time subscriptions ensure all clients stay synchronized during both phases.

## UI Components

Special UI components handle the two-step process:

1. `GameButton.svelte`: Primary shot button with commit/reveal states
2. `DiscountButton.svelte`: For shots using available discounts
3. `BonusShotButton.svelte`: For shots using bonus shots

Each button has distinct states for commit and reveal phases, with appropriate loading and disabled states.

## Best Practices

1. **Always Check Pending Shots**: On page load, check for pending shots that need to be revealed
2. **Handle Connection Issues**: Provide retry mechanisms for failed transactions
3. **Clear Storage After Reveal**: Remove pending shot data after successful reveal
4. **Provide Clear User Feedback**: Inform the user about each step of the process
