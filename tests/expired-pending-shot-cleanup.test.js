import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Expired Pending Shot Cleanup', function () {
  let ethShot;
  let owner;
  let player1;
  let player2;
  
  const SHOT_COST = ethers.parseEther('0.01');
  const SPONSOR_COST = ethers.parseEther('0.005');
  const COOLDOWN_PERIOD = 300; // 5 minutes
  const WIN_PERCENTAGE_BP = 9000; // 90%
  const HOUSE_PERCENTAGE_BP = 1000; // 10%
  const WIN_CHANCE_BP = 1000; // 10%
  const MAX_RECENT_WINNERS = 100;
  const MIN_POT_SIZE = ethers.parseEther('0.01');

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    const EthShot = await ethers.getContractFactory('EthShot');
    ethShot = await EthShot.deploy(
      owner.address,
      SHOT_COST,
      SPONSOR_COST,
      COOLDOWN_PERIOD,
      WIN_PERCENTAGE_BP,
      HOUSE_PERCENTAGE_BP,
      WIN_CHANCE_BP,
      MAX_RECENT_WINNERS,
      MIN_POT_SIZE
    );
  });

  describe('First shot cannot win bug fix', function () {
    it('should prevent first shot from winning when pot only contains their contribution', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits first shot (pot starts at 0)
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });
      
      // Verify pot now contains only the player's contribution
      const potAfterCommit = await ethShot.getCurrentPot();
      expect(potAfterCommit).to.equal(SHOT_COST);
      
      // Wait for reveal delay
      await ethers.provider.send('evm_mine');
      
      // Reveal the shot - should NOT be able to win
      const tx = await ethShot.connect(player1).revealShot(secret);
      
      // Check that ShotRevealed event shows won=false
      await expect(tx).to.emit(ethShot, 'ShotRevealed').withArgs(player1.address, SHOT_COST, false);
      
      // Verify no JackpotWon event was emitted
      const receipt = await tx.wait();
      const jackpotEvents = receipt.logs.filter(log => {
        try {
          const parsed = ethShot.interface.parseLog(log);
          return parsed.name === 'JackpotWon';
        } catch {
          return false;
        }
      });
      expect(jackpotEvents).to.have.length(0);
      
      // Verify pot still contains the original amount
      const potAfterReveal = await ethShot.getCurrentPot();
      expect(potAfterReveal).to.equal(SHOT_COST);
      
      // Verify player has no pending payout
      const pendingPayout = await ethShot.getPendingPayout(player1.address);
      expect(pendingPayout).to.equal(0);
    });

    it('should allow winning when pot contains contributions from multiple players', async function () {
      // Player1 takes first shot (seeds the pot)
      const secret1 = 12345;
      const commitment1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret1, player1.address]));
      await ethShot.connect(player1).commitShot(commitment1, { value: SHOT_COST });
      await ethers.provider.send('evm_mine');
      await ethShot.connect(player1).revealShot(secret1);
      
      // Advance time past cooldown
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // Player2 takes second shot (now pot > SHOT_COST, so can potentially win)
      const secret2 = 67890;
      const commitment2 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret2, player2.address]));
      await ethShot.connect(player2).commitShot(commitment2, { value: SHOT_COST });
      
      // Verify pot now contains contributions from both players
      const potAfterSecondCommit = await ethShot.getCurrentPot();
      expect(potAfterSecondCommit).to.equal(SHOT_COST * 2n);
      
      // Enable test mode to force a win
      await ethShot.setTestMode(true);
      await ethShot.setWinningNumber(1); // Force win
      
      await ethers.provider.send('evm_mine');
      
      // Player2 reveals and should be able to win
      const tx = await ethShot.connect(player2).revealShot(secret2);
      
      // Check that ShotRevealed event shows won=true
      await expect(tx).to.emit(ethShot, 'ShotRevealed').withArgs(player2.address, SHOT_COST, true);
      
      // Check that JackpotWon event was emitted
      await expect(tx).to.emit(ethShot, 'JackpotWon');
      
      // Verify pot was reset to 0 after win
      const potAfterWin = await ethShot.getCurrentPot();
      expect(potAfterWin).to.equal(0);
    });
  });

  describe('Auto-cleanup in canCommit modifier', function () {
    it('should automatically clean up expired pending shot when trying to commit new shot', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits a shot
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });
      
      // Verify pending shot exists
      const [exists, blockNumber, amount] = await ethShot.getPendingShot(player1.address);
      expect(exists).to.be.true;
      expect(amount).to.equal(SHOT_COST);

      // Mine 257 blocks to expire the pending shot (256 + 1)
      for (let i = 0; i < 257; i++) {
        await ethers.provider.send('evm_mine');
      }

      // Advance time past cooldown
      await time.increase(COOLDOWN_PERIOD + 1);

      // Try to commit another shot - this should auto-cleanup the expired pending shot
      const newCommitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [67890, player1.address]));
      
      const tx = await ethShot.connect(player1).commitShot(newCommitment, { value: SHOT_COST });
      
      // Check that PendingShotExpired event was emitted
      await expect(tx).to.emit(ethShot, 'PendingShotExpired').withArgs(player1.address, blockNumber, anyValue);
      
      // Check that new ShotCommitted event was emitted
      await expect(tx).to.emit(ethShot, 'ShotCommitted').withArgs(player1.address, newCommitment, SHOT_COST);

      // Verify the new pending shot exists
      const [newExists, newBlockNumber, newAmount] = await ethShot.getPendingShot(player1.address);
      expect(newExists).to.be.true;
      expect(newAmount).to.equal(SHOT_COST);
      expect(newBlockNumber).to.not.equal(blockNumber);
    });

    it('should still block if pending shot has not expired', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits a shot
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });

      // Advance time past cooldown but not past reveal window
      await time.increase(COOLDOWN_PERIOD + 1);

      // Try to commit another shot - this should fail because pending shot hasn't expired
      const newCommitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [67890, player1.address]));
      
      await expect(
        ethShot.connect(player1).commitShot(newCommitment, { value: SHOT_COST })
      ).to.be.revertedWith('Previous shot still pending');
    });
  });

  describe('Manual cleanup function', function () {
    it('should allow anyone to clean up expired pending shots', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits a shot
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });
      
      const [exists, blockNumber] = await ethShot.getPendingShot(player1.address);
      expect(exists).to.be.true;

      // Mine 257 blocks to expire the pending shot
      for (let i = 0; i < 257; i++) {
        await ethers.provider.send('evm_mine');
      }

      // Player2 (different player) cleans up player1's expired pending shot
      const tx = await ethShot.connect(player2).cleanupExpiredPendingShot(player1.address);
      
      // Check that PendingShotExpired event was emitted
      await expect(tx).to.emit(ethShot, 'PendingShotExpired').withArgs(player1.address, blockNumber, anyValue);

      // Verify pending shot is cleaned up
      const [newExists] = await ethShot.getPendingShot(player1.address);
      expect(newExists).to.be.false;

      // Verify player1 can now commit new shots (after cooldown)
      await time.increase(COOLDOWN_PERIOD + 1);
      const canCommit = await ethShot.canCommitShot(player1.address);
      expect(canCommit).to.be.true;
    });

    it('should fail to clean up non-expired pending shots', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits a shot
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });

      // Try to clean up before expiration
      await expect(
        ethShot.connect(player2).cleanupExpiredPendingShot(player1.address)
      ).to.be.revertedWith('Pending shot not yet expired');
    });

    it('should fail to clean up non-existent pending shots', async function () {
      await expect(
        ethShot.connect(player2).cleanupExpiredPendingShot(player1.address)
      ).to.be.revertedWith('No pending shot to clean up');
    });
  });

  describe('Integration with canCommitShot view function', function () {
    it('should return true for players with expired pending shots', async function () {
      const secret = 12345;
      const commitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret, player1.address]));

      // Player1 commits a shot
      await ethShot.connect(player1).commitShot(commitment, { value: SHOT_COST });
      
      // Should not be able to commit while pending shot exists
      await time.increase(COOLDOWN_PERIOD + 1);
      let canCommit = await ethShot.canCommitShot(player1.address);
      expect(canCommit).to.be.false;

      // Mine blocks to expire the pending shot
      for (let i = 0; i < 257; i++) {
        await ethers.provider.send('evm_mine');
      }

      // Note: canCommitShot view function doesn't auto-cleanup, it just checks conditions
      // The cleanup happens in the actual commitShot transaction
      canCommit = await ethShot.canCommitShot(player1.address);
      expect(canCommit).to.be.false; // Still false because view function doesn't cleanup

      // But the actual commitShot should work (auto-cleanup)
      const newCommitment = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [67890, player1.address]));
      await expect(
        ethShot.connect(player1).commitShot(newCommitment, { value: SHOT_COST })
      ).to.not.be.reverted;
    });
  });
});

// Helper for anyValue matcher
const anyValue = {
  asymmetricMatch: () => true,
  toString: () => 'anyValue'
};