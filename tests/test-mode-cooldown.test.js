import { expect } from 'chai';
import hre from 'hardhat';
const { ethers } = hre;

describe('EthShot Test Mode Cooldown', () => {
  let ethShot;
  let owner;
  let player;
  
  const SHOT_COST = ethers.parseEther('0.01');
  const SPONSOR_COST = ethers.parseEther('0.1');
  const COOLDOWN_PERIOD = 3600; // 1 hour
  const WIN_PERCENTAGE_BP = 8000; // 80%
  const HOUSE_PERCENTAGE_BP = 2000; // 20%
  const WIN_CHANCE_BP = 1000; // 10%
  const MAX_RECENT_WINNERS = 100;
  const MIN_POT_SIZE = SHOT_COST;

  beforeEach(async () => {
    [owner, player] = await ethers.getSigners();
    
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
    
    await ethShot.waitForDeployment();
  });

  describe('Cooldown Behavior', () => {
    it('should use normal 1-hour cooldown when test mode is disabled', async () => {
      // Test mode is disabled by default
      const testModeConfig = await ethShot.getTestModeConfig();
      expect(testModeConfig.isTestMode).to.be.false;
      
      // Take a shot
      const secret1 = 12345n;
      const commitment1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret1, player.address]));
      
      await ethShot.connect(player).commitShot(commitment1, { value: SHOT_COST });
      
      // Wait for reveal delay
      await ethers.provider.send('evm_mine', []);
      
      // Reveal shot
      await ethShot.connect(player).revealShot(secret1);
      
      // Check cooldown - should be close to 1 hour (3600 seconds)
      const cooldownRemaining = await ethShot.getCooldownRemaining(player.address);
      expect(cooldownRemaining).to.be.greaterThan(3590n); // Allow some variance for block time
      expect(cooldownRemaining).to.be.lessThanOrEqual(3600n);
      
      // Should not be able to commit another shot immediately
      expect(await ethShot.canCommitShot(player.address)).to.be.false;
    });

    it('should use 1-minute cooldown when test mode is enabled', async () => {
      // Enable test mode
      await ethShot.setTestMode(true);
      
      const testModeConfig = await ethShot.getTestModeConfig();
      expect(testModeConfig.isTestMode).to.be.true;
      
      // Take a shot
      const secret1 = 12345n;
      const commitment1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret1, player.address]));
      
      await ethShot.connect(player).commitShot(commitment1, { value: SHOT_COST });
      
      // Wait for reveal delay
      await ethers.provider.send('evm_mine', []);
      
      // Reveal shot
      await ethShot.connect(player).revealShot(secret1);
      
      // Check cooldown - should be close to 1 minute (60 seconds)
      const cooldownRemaining = await ethShot.getCooldownRemaining(player.address);
      expect(cooldownRemaining).to.be.greaterThan(50n); // Allow some variance for block time
      expect(cooldownRemaining).to.be.lessThanOrEqual(60n);
      
      // Should not be able to commit another shot immediately
      expect(await ethShot.canCommitShot(player.address)).to.be.false;
    });

    it('should switch cooldown periods when toggling test mode', async () => {
      // Start with test mode disabled (1 hour cooldown)
      expect(await ethShot.testMode()).to.be.false;
      
      // Take a shot with normal cooldown
      const secret1 = 12345n;
      const commitment1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret1, player.address]));
      
      await ethShot.connect(player).commitShot(commitment1, { value: SHOT_COST });
      await ethers.provider.send('evm_mine', []);
      await ethShot.connect(player).revealShot(secret1);
      
      // Check normal cooldown
      let cooldownRemaining = await ethShot.getCooldownRemaining(player.address);
      expect(cooldownRemaining).to.be.greaterThan(3590n);
      
      // Enable test mode - cooldown should immediately reflect the change
      await ethShot.setTestMode(true);
      
      // Check cooldown again - should now show test cooldown
      cooldownRemaining = await ethShot.getCooldownRemaining(player.address);
      expect(cooldownRemaining).to.be.lessThanOrEqual(60n);
      
      // Disable test mode - cooldown should switch back
      await ethShot.setTestMode(false);
      
      cooldownRemaining = await ethShot.getCooldownRemaining(player.address);
      expect(cooldownRemaining).to.be.greaterThan(3590n);
    });

    it('should allow rapid testing with 1-minute cooldown in test mode', async () => {
      // Enable test mode
      await ethShot.setTestMode(true);
      
      // Take first shot
      const secret1 = 12345n;
      const commitment1 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret1, player.address]));
      
      await ethShot.connect(player).commitShot(commitment1, { value: SHOT_COST });
      await ethers.provider.send('evm_mine', []);
      await ethShot.connect(player).revealShot(secret1);
      
      // Fast forward 61 seconds to bypass cooldown
      await ethers.provider.send('evm_increaseTime', [61]);
      await ethers.provider.send('evm_mine', []);
      
      // Should be able to take another shot
      expect(await ethShot.canCommitShot(player.address)).to.be.true;
      
      const secret2 = 67890n;
      const commitment2 = ethers.keccak256(ethers.solidityPacked(['uint256', 'address'], [secret2, player.address]));
      
      // This should not revert
      await ethShot.connect(player).commitShot(commitment2, { value: SHOT_COST });
    });
  });
});