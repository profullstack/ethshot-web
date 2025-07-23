import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('EthShot Contract', function () {
  // Test fixture to deploy the contract
  async function deployEthShotFixture() {
    const [owner, player1, player2, sponsor] = await ethers.getSigners();
    
    const EthShot = await ethers.getContractFactory('EthShot');
    const ethShot = await EthShot.deploy(owner.address);
    
    const shotCost = ethers.parseEther('0.001');
    const sponsorCost = ethers.parseEther('0.05');
    
    return { ethShot, owner, player1, player2, sponsor, shotCost, sponsorCost };
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { ethShot, owner } = await loadFixture(deployEthShotFixture);
      expect(await ethShot.owner()).to.equal(owner.address);
    });

    it('Should set the correct shot cost', async function () {
      const { ethShot, shotCost } = await loadFixture(deployEthShotFixture);
      expect(await ethShot.SHOT_COST()).to.equal(shotCost);
    });

    it('Should set the correct sponsor cost', async function () {
      const { ethShot, sponsorCost } = await loadFixture(deployEthShotFixture);
      expect(await ethShot.SPONSOR_COST()).to.equal(sponsorCost);
    });

    it('Should initialize with zero pot', async function () {
      const { ethShot } = await loadFixture(deployEthShotFixture);
      expect(await ethShot.getCurrentPot()).to.equal(0);
    });
  });

  describe('Taking Shots', function () {
    it('Should accept correct payment for a shot', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await expect(ethShot.connect(player1).takeShot({ value: shotCost }))
        .to.not.be.reverted;
    });

    it('Should reject incorrect payment amount', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      const wrongAmount = shotCost + ethers.parseEther('0.001');
      await expect(ethShot.connect(player1).takeShot({ value: wrongAmount }))
        .to.be.revertedWith('Incorrect payment amount');
    });

    it('Should increase pot size after shot', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      expect(await ethShot.getCurrentPot()).to.equal(shotCost);
    });

    it('Should enforce cooldown period', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      await expect(ethShot.connect(player1).takeShot({ value: shotCost }))
        .to.be.revertedWith('Cooldown period not elapsed');
    });

    it('Should emit ShotTaken event', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await expect(ethShot.connect(player1).takeShot({ value: shotCost }))
        .to.emit(ethShot, 'ShotTaken')
        .withArgs(player1.address, shotCost, false);
    });

    it('Should track player statistics', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      const stats = await ethShot.getPlayerStats(player1.address);
      expect(stats.totalShots).to.equal(1);
      expect(stats.totalSpent).to.equal(shotCost);
    });
  });

  describe('Winning Logic', function () {
    it('Should handle winning shot correctly', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      // Mock a winning scenario by setting a predictable seed
      await ethShot.setTestMode(true);
      await ethShot.setWinningNumber(1); // Force a win
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      await expect(ethShot.connect(player1).takeShot({ value: shotCost }))
        .to.emit(ethShot, 'ShotTaken')
        .withArgs(player1.address, shotCost, true);
      
      // Check that pot was reset
      expect(await ethShot.getCurrentPot()).to.equal(0);
    });

    it('Should pay winner 90% of pot', async function () {
      const { ethShot, player1, player2, shotCost } = await loadFixture(deployEthShotFixture);
      
      // Build up pot with multiple shots
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      // Fast forward time to bypass cooldown
      await ethers.provider.send('evm_increaseTime', [3601]);
      await ethers.provider.send('evm_mine');
      
      await ethShot.connect(player2).takeShot({ value: shotCost });
      
      const potBeforeWin = await ethShot.getCurrentPot();
      const expectedWinnings = (potBeforeWin * 90n) / 100n;
      
      // Set up winning scenario
      await ethShot.setTestMode(true);
      await ethShot.setWinningNumber(1);
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      const tx = await ethShot.connect(player1).takeShot({ value: shotCost });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(player1.address);
      const actualWinnings = finalBalance - initialBalance + gasUsed + shotCost;
      
      expect(actualWinnings).to.be.closeTo(expectedWinnings, ethers.parseEther('0.0001'));
    });
  });

  describe('Sponsorship', function () {
    it('Should accept sponsor payment', async function () {
      const { ethShot, sponsor, sponsorCost } = await loadFixture(deployEthShotFixture);
      
      await expect(ethShot.connect(sponsor).sponsorRound('Test Sponsor', 'https://example.com/logo.png', { value: sponsorCost }))
        .to.not.be.reverted;
    });

    it('Should reject incorrect sponsor payment', async function () {
      const { ethShot, sponsor, sponsorCost } = await loadFixture(deployEthShotFixture);
      
      const wrongAmount = sponsorCost - ethers.parseEther('0.01');
      await expect(ethShot.connect(sponsor).sponsorRound('Test Sponsor', 'https://example.com/logo.png', { value: wrongAmount }))
        .to.be.revertedWith('Incorrect sponsor payment');
    });

    it('Should store sponsor information', async function () {
      const { ethShot, sponsor, sponsorCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(sponsor).sponsorRound('Test Sponsor', 'https://example.com/logo.png', { value: sponsorCost });
      
      const sponsorInfo = await ethShot.getCurrentSponsor();
      expect(sponsorInfo.name).to.equal('Test Sponsor');
      expect(sponsorInfo.logoUrl).to.equal('https://example.com/logo.png');
      expect(sponsorInfo.sponsor).to.equal(sponsor.address);
    });

    it('Should emit SponsorshipActivated event', async function () {
      const { ethShot, sponsor, sponsorCost } = await loadFixture(deployEthShotFixture);
      
      await expect(ethShot.connect(sponsor).sponsorRound('Test Sponsor', 'https://example.com/logo.png', { value: sponsorCost }))
        .to.emit(ethShot, 'SponsorshipActivated')
        .withArgs(sponsor.address, 'Test Sponsor', 'https://example.com/logo.png');
    });

    it('Should clear sponsorship after win', async function () {
      const { ethShot, player1, sponsor, shotCost, sponsorCost } = await loadFixture(deployEthShotFixture);
      
      // Set up sponsorship
      await ethShot.connect(sponsor).sponsorRound('Test Sponsor', 'https://example.com/logo.png', { value: sponsorCost });
      
      // Set up winning scenario
      await ethShot.setTestMode(true);
      await ethShot.setWinningNumber(1);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      const sponsorInfo = await ethShot.getCurrentSponsor();
      expect(sponsorInfo.name).to.equal('');
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to withdraw house funds', async function () {
      const { ethShot, owner, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      // Generate some house funds
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      await ethShot.connect(owner).withdrawHouseFunds();
      const finalBalance = await ethers.provider.getBalance(owner.address);
      
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it('Should reject non-owner withdrawal attempts', async function () {
      const { ethShot, player1 } = await loadFixture(deployEthShotFixture);
      
      await expect(ethShot.connect(player1).withdrawHouseFunds())
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should allow owner to pause contract', async function () {
      const { ethShot, owner, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(owner).pause();
      
      await expect(ethShot.connect(player1).takeShot({ value: shotCost }))
        .to.be.revertedWith('Pausable: paused');
    });
  });

  describe('View Functions', function () {
    it('Should return correct pot size', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      expect(await ethShot.getCurrentPot()).to.equal(shotCost);
    });

    it('Should return player cooldown status', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      expect(await ethShot.canTakeShot(player1.address)).to.be.true;
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      expect(await ethShot.canTakeShot(player1.address)).to.be.false;
    });

    it('Should return recent winners', async function () {
      const { ethShot, player1, shotCost } = await loadFixture(deployEthShotFixture);
      
      // Set up winning scenario
      await ethShot.setTestMode(true);
      await ethShot.setWinningNumber(1);
      
      await ethShot.connect(player1).takeShot({ value: shotCost });
      
      const recentWinners = await ethShot.getRecentWinners();
      expect(recentWinners.length).to.be.gt(0);
      expect(recentWinners[0].winner).to.equal(player1.address);
    });
  });
});